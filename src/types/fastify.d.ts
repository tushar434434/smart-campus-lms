import type { UserRole } from '../modules/auth/auth.schema.js';

declare module 'fastify' {
  interface FastifyInstance {
    getCurrentUserRole(userId: string): Promise<UserRole | undefined>;
  }
}
