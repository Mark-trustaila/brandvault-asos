import { PrismaClient } from '@prisma/client';

/**
 * Shared Prisma client.
 *
 * A single instance is reused across requests. In development it is cached on
 * globalThis so Next.js hot-reload doesn't open a new connection pool on every
 * edit. On Vercel serverless each function instance keeps one client, and the
 * pool size is bounded via `connection_limit` in DATABASE_URL (see
 * .env.example) so bursts don't exhaust Azure MySQL's connection cap.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
