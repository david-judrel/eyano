export { PrismaClient } from '@prisma/client';
export type {
  User,
  Account,
  Session,
  Conversation,
  Message,
  Attachment,
  Usage,
  AccountProvider,
  MessageRole,
} from '@prisma/client';

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
