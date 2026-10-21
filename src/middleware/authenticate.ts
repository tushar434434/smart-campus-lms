import type { FastifyRequest } from 'fastify';

import { AppError } from '../errors/app-error.js';

export async function authenticate(request: FastifyRequest): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  }
}
