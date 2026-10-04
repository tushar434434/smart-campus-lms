import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../errors/app-error.js';
import type { UserRole } from '../modules/auth/auth.schema.js';

export function authorize(...allowedRoles: UserRole[]) {
  return async function (
    request: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const user = request.user as { sub: string; role: UserRole };

    if (!allowedRoles.includes(user.role)) {
      throw new AppError(
        'You do not have permission to perform this action',
        403,
        'FORBIDDEN',
      );
    }
  };
}
