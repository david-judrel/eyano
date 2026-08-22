import { Injectable, BadRequestException } from '@nestjs/common';
import { prisma } from '../../lib/prisma';

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
  async upload(messageId: string, file: Express.Multer.File) {
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

  async findByMessage(messageId: string) {
    return prisma.attachment.findMany({ where: { messageId } });
  }
}
