import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  WASocket,
  proto,
  isJidGroup,
  downloadMediaMessage,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import { chatFlowSync } from '@eyano/ai';
import { ChatMessage, ImageAttachment } from '@eyano/types';

const ANTI_BAN = {
  readDelay: 2000,
  typingMultiplier: 40,
  minTypingDelay: 2000,
  maxTypingDelay: 12000,
};

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_DOC_SIZE = 20 * 1024 * 1024;

function computeTypingDelay(responseLength: number): number {
  const base = responseLength * ANTI_BAN.typingMultiplier;
  return Math.max(ANTI_BAN.minTypingDelay, Math.min(base, ANTI_BAN.maxTypingDelay));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class WhatsAppService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppService.name);
  private sock: WASocket | null = null;
  private isReady = false;
  private restartTimeout: NodeJS.Timeout | null = null;

  async onModuleInit() {
    await this.initSocket();
  }

  async onModuleDestroy() {
    this.isReady = false;
    if (this.restartTimeout) clearTimeout(this.restartTimeout);
    if (this.sock) {
      this.logger.log('Fermeture du socket WhatsApp...');
      this.sock.end(undefined);
    }
  }

  private async initSocket() {
    const { state, saveCreds } = await useMultiFileAuthState('.whatsapp_auth');

    this.sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: ['Eyano', 'Chrome', '4.0.0'],
      generateHighQualityLinkPreview: false,
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.logger.log('--- QR Code WhatsApp ---');
        qrcode.generate(qr, { small: true }, (code) => {
          process.stdout.write(code + '\n');
        });
        this.logger.log('Scannez le QR code ci-dessus avec WhatsApp');
      }

      if (connection === 'open') {
        this.isReady = true;
        this.logger.log('WhatsApp pret ! Connecte.');
      }

      if (connection === 'close') {
        this.isReady = false;
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        this.logger.warn(`WhatsApp deconnecte (code: ${statusCode}). Reconnexion: ${shouldReconnect}`);

        if (shouldReconnect) {
          this.scheduleRestart(3000);
        } else {
          this.logger.log('Session expiree. Supprimez .whatsapp_auth et redemarrez.');
        }
      }
    });

    this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        try {
          await this.handleMessage(msg);
        } catch (error: any) {
          this.logger.error('Erreur message handler:', error?.message || error);
        }
      }
    });
  }

  private async handleMessage(msg: proto.IWebMessageInfo) {
    if (!msg.message || !msg.key?.remoteJid) return;
    if (msg.key.fromMe) return;

    const jid = msg.key.remoteJid;
    if (isJidGroup(jid)) return;
    if (!jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@lid')) return;

    const pushName = msg.pushName || 'Unknown';
    const messageContent = msg.message;

    let userText = '';
    let images: ImageAttachment[] = [];
    let docInfo: { name: string; mimetype: string; size: number } | null = null;

    if (messageContent.conversation) {
      userText = messageContent.conversation;
    } else if (messageContent.extendedTextMessage?.text) {
      userText = messageContent.extendedTextMessage.text;
    } else if (messageContent.imageMessage) {
      const img = messageContent.imageMessage;
      userText = img.caption || 'Regarde cette image.';
      try {
        if (img.fileLength && Number(img.fileLength) > MAX_IMAGE_SIZE) {
          await this.sendMessage(jid, "L'image est trop lourde (max 10 Mo). Envoie une image plus petite 🙏");
          return;
        }
        const buffer = await downloadMediaMessage(msg as any, 'buffer', {});
        images = [{ mimeType: img.mimetype || 'image/jpeg', data: buffer.toString('base64') }];
        this.logger.log(`Image recue: ${img.mimetype}, ${(Number(img.fileLength || 0) / 1024 / 1024).toFixed(1)} Mo`);
      } catch (e: any) {
        this.logger.error('Erreur download image:', e?.message);
        await this.sendMessage(jid, "J'ai pas pu recuperer l'image. Reessaye 🙏");
        return;
      }
    } else if (messageContent.documentMessage) {
      const doc = messageContent.documentMessage;
      const docSize = Number(doc.fileLength || 0);
      const docMime = doc.mimetype || '';
      const docName = doc.fileName || 'document';

      if (docSize > MAX_DOC_SIZE) {
        await this.sendMessage(jid, `Le fichier "${docName}" est trop lourd (${(docSize / 1024 / 1024).toFixed(1)} Mo). Max: 20 Mo.`);
        return;
      }

      const textTypes = ['text/plain', 'text/csv', 'text/markdown', 'text/html', 'application/json'];
      const isText = textTypes.some(t => docMime.includes(t)) || docName.endsWith('.txt') || docName.endsWith('.md') || docName.endsWith('.json') || docName.endsWith('.csv');

      if (isText) {
        try {
          const buffer = await downloadMediaMessage(msg as any, 'buffer', {});
          const content = buffer.toString('utf-8');
          if (content.length > 50000) {
            await this.sendMessage(jid, "Le fichier est trop grand pour etre analyse (max 50 000 caracteres).");
            return;
          }
          userText = `Voici le contenu du fichier "${docName}" :\n\n${content}`;
          this.logger.log(`Document texte recu: ${docName} (${content.length} car.)`);
        } catch (e: any) {
          this.logger.error('Erreur download document:', e?.message);
          await this.sendMessage(jid, "J'ai pas pu lire le fichier. Reessaye 🙏");
          return;
        }
      } else if (docMime.includes('image/')) {
        try {
          const buffer = await downloadMediaMessage(msg as any, 'buffer', {});
          images = [{ mimeType: docMime, data: buffer.toString('base64') }];
          userText = doc.caption || `Regarde ce fichier image: ${docName}`;
          this.logger.log(`Document image recu: ${docName}`);
        } catch (e: any) {
          this.logger.error('Erreur download image doc:', e?.message);
          await this.sendMessage(jid, "J'ai pas pu recuperer l'image. Reessaye 🙏");
          return;
        }
      } else {
        await this.sendMessage(jid, `Le fichier "${docName}" (${docMime}) n'est pas supporte pour le moment. Je peux analyser les images et les fichiers texte (TXT, CSV, MD, JSON).`);
        return;
      }
    } else if (messageContent.videoMessage) {
      userText = messageContent.videoMessage.caption || "J'ai recu une video mais je peux pas les analyser pour le moment 🙏";
    } else if (messageContent.audioMessage) {
      await this.sendMessage(jid, "Je peux pas ecouter les audio pour le moment. Envoie-moi un message texte 🙏");
      return;
    } else {
      return;
    }

    if (!userText && images.length === 0) return;

    this.logger.log(`Message de ${pushName} (${jid}): ${userText.substring(0, 80)}...`);

    await sleep(ANTI_BAN.readDelay);

    if (this.sock) {
      try { await this.sock.sendPresenceUpdate('available', jid); } catch {}
      try { await this.sock.sendPresenceUpdate('composing', jid); } catch {}
    }

    const chatMessages: ChatMessage[] = [{
      role: 'user',
      content: userText,
      images: images.length > 0 ? images : undefined,
    }];

    const fakeUserId = `whatsapp_${jid.replace(/[^0-9]/g, '')}`;
    const fakeConvId = `wa_conv_${jid.replace(/[^0-9]/g, '')}`;

    let responseText: string;
    try {
      const result = await chatFlowSync({
        userId: fakeUserId,
        conversationId: fakeConvId,
        messages: chatMessages,
        channel: 'whatsapp',
      });
      responseText = result.content;
    } catch (error: any) {
      this.logger.error('Erreur IA:', error?.message || error);
      responseText = "Oups, j'ai eu un petit bug. Reessaye stp 🙏";
    }

    const typingDelay = computeTypingDelay(responseLength(responseText));
    await sleep(typingDelay);

    await this.sendMessage(jid, responseText);
  }

  private async sendMessage(jid: string, text: string) {
    if (!this.sock) return;
    try {
      await this.sock.sendMessage(jid, { text });
      this.logger.log(`Reponse envoyee a ${jid}`);
    } catch (error: any) {
      this.logger.error("Erreur envoi:", error?.message || error);
    }
  }

  private scheduleRestart(delayMs: number) {
    if (this.restartTimeout) clearTimeout(this.restartTimeout);
    this.isReady = false;
    this.logger.log(`Redemarrage dans ${delayMs / 1000}s...`);
    this.restartTimeout = setTimeout(async () => {
      await this.initSocket();
    }, delayMs);
  }

  getStatus() {
    return { isReady: this.isReady, isConnected: this.sock !== null };
  }
}

function responseLength(text: string): number {
  return text.length;
}
