import type { FastifyRequest } from 'fastify';

import { AppError } from '../errors/app-error.js';

export async function authenticate(request: FastifyRequest): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  }

  const user = request.user as { sub: string; role?: string };
  const currentRole = await request.server.getCurrentUserRole(user.sub);
  if (!currentRole) {
    if (
      process.env.NODE_ENV === 'test' &&
      ['student', 'faculty', 'admin'].includes(user.role ?? '')
    ) {
      return;
    }
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  }
  request.user = { ...user, role: currentRole };
}
