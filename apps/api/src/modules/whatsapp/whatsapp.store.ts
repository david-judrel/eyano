import { promises as fs } from 'fs';
import * as path from 'path';
import { ChatMessage } from '@eyano/types';

/**
 * Abstraction minimale de persistance du contexte conversationnel WhatsApp.
 *
 * Objectif (etape 8) : conserver et transmettre le contexte utile d'un JID
 * au-dela du redemarrage du processus, SANS construire de memoire avancee,
 * de memoire vectorielle ni de memoire autonome.
 *
 * Le stockage reste remplace : l'injection d'une autre implementation
 * (base de donnees, ...) ne touche pas au service WhatsApp.
 */
export interface WhatsAppHistoryStore {
  /** Historique d'un JID, ou une liste vide si rien n'est enregistre. */
  load(jid: string): Promise<ChatMessage[]>;
  /** Remplace l'historique d'un JID. */
  save(jid: string, messages: ChatMessage[]): Promise<void>;
}

/**
 * Les images sont des pieces jointes en base64 (jusqu'a 10 Mo) : on ne les
 * persiste pas. Elles restent disponibles en memoire vive le temps de la
 * session, ce qui conserve le comportement courant du service.
 */
function toPersistable(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) => ({ role: message.role, content: message.content }));
}

function isPersisted(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ChatMessage>;
  return (
    (candidate.role === 'user' || candidate.role === 'assistant') &&
    typeof candidate.content === 'string'
  );
}

export class InMemoryWhatsAppHistoryStore implements WhatsAppHistoryStore {
  private readonly data = new Map<string, string>();

  async load(jid: string): Promise<ChatMessage[]> {
    const raw = this.data.get(jid);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(isPersisted) : [];
    } catch {
      return [];
    }
  }

  async save(jid: string, messages: ChatMessage[]): Promise<void> {
    this.data.set(jid, JSON.stringify(toPersistable(messages)));
  }
}

/**
 * Stockage fichier : un document JSON par JID.
 *
 * Choisi pour son cout minimal (aucune migration, aucun schema) tout en
 * survivant a un redemarrage. Les ecritures sont atomiques (fichier
 * temporaire puis renommage) pour eviter un JSON tronque en cas d'arret.
 */
export class FileWhatsAppHistoryStore implements WhatsAppHistoryStore {
  constructor(private readonly directory: string) {}

  private fileFor(jid: string): string {
    const safe = jid.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
    return path.join(this.directory, `${safe || 'unknown'}.json`);
  }

  async load(jid: string): Promise<ChatMessage[]> {
    try {
      const raw = await fs.readFile(this.fileFor(jid), 'utf-8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(isPersisted) : [];
    } catch {
      return [];
    }
  }

  async save(jid: string, messages: ChatMessage[]): Promise<void> {
    await fs.mkdir(this.directory, { recursive: true });

    const target = this.fileFor(jid);
    const temporary = `${target}.${process.pid}.tmp`;

    await fs.writeFile(temporary, JSON.stringify(toPersistable(messages)), 'utf-8');
    await fs.rename(temporary, target);
  }
}
