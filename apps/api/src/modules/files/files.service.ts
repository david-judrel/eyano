import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { prisma } from '../../lib/prisma';
import { ATTACHMENT_PUBLIC_SELECT } from './attachment-select';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;  // 10MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;   // 50MB
const MAX_IMAGES_PER_MESSAGE = 2;
const MAX_FILES_PER_MESSAGE = 5;

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const DOCUMENT_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];
const ALLOWED_TYPES = [...IMAGE_TYPES, ...DOCUMENT_TYPES];

@Injectable()
export class FilesService {
  /**
   * Etape 46 (I4) : un message appartient au proprietaire de SA conversation.
   * Inexistant ou appartenant a un autre utilisateur : meme reponse
   * (NotFound), pour ne pas reveler l'existence du message.
   */
  private async assertMessageOwner(messageId: string, userId: string): Promise<void> {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { conversationId: true },
    });
    const conversation = message
      ? await prisma.conversation.findUnique({
          where: { id: message.conversationId },
          select: { userId: true },
        })
      : null;

    if (!conversation || conversation.userId !== userId) {
      throw new NotFoundException('Message non trouve');
    }
  }

  async upload(messageId: string, file: Express.Multer.File, userId: string) {
    await this.assertMessageOwner(messageId, userId);

    const isImage = IMAGE_TYPES.includes(file.mimetype);
    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;

    if (file.size > maxSize) {
      const maxMb = Math.round(maxSize / (1024 * 1024));
      throw new BadRequestException(`Le fichier "${file.originalname}" est trop volumineux (max ${maxMb}MB)`);
    }

    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`Type "${file.mimetype}" non supporté`);
    }

    const existing = await prisma.attachment.findMany({ where: { messageId } });
    const existingImages = existing.filter((a) => IMAGE_TYPES.includes(a.mimeType));

    if (isImage && existingImages.length >= MAX_IMAGES_PER_MESSAGE) {
      throw new BadRequestException(`Maximum ${MAX_IMAGES_PER_MESSAGE} images par message`);
    }

    if (existing.length >= MAX_FILES_PER_MESSAGE) {
      throw new BadRequestException(`Maximum ${MAX_FILES_PER_MESSAGE} fichiers par message`);
    }

    const storageKey = `uploads/${messageId}/${file.originalname}`;

    return prisma.attachment.create({
      data: {
        messageId,
        fileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storageKey,
      },
    });
  }

  async findByMessage(messageId: string, userId: string) {
    await this.assertMessageOwner(messageId, userId);
    return prisma.attachment.findMany({ where: { messageId }, select: ATTACHMENT_PUBLIC_SELECT });
  }

  /**
   * Octets d'une piece jointe conservee en base (images Kepler). Meme
   * controle que le reste du module : seul le proprietaire de la
   * conversation y accede, sinon NotFound.
   */
  async getContent(id: string, userId: string): Promise<{ data: Buffer; mimeType: string; fileName: string }> {
    const attachment = await prisma.attachment.findUnique({
      where: { id },
      select: { messageId: true, mimeType: true, fileName: true, data: true },
    });
    if (!attachment) {
      throw new NotFoundException('Fichier non trouve');
    }
    await this.assertMessageOwner(attachment.messageId, userId);
    if (!attachment.data) {
      throw new NotFoundException('Fichier non trouve');
    }
    return { data: Buffer.from(attachment.data), mimeType: attachment.mimeType, fileName: attachment.fileName };
  }
}
