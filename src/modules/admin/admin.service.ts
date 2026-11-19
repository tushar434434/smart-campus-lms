import { AppError } from '../../errors/app-error.js';
import type { UserRole } from '../auth/auth.schema.js';
import type { AdminRepository } from './admin.repository.interface.js';

export function createAdminService(repository: AdminRepository) {
  return {
    async requireAdmin(actorId: string): Promise<void> {
      const role = await repository.findRole(actorId);
      if (!role) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }
      if (role !== 'admin') {
        throw new AppError('Administrator access required', 403, 'FORBIDDEN');
      }
    },

    async getDashboardStats() {
      return repository.getDashboardStats();
    },

    async getUser(userId: string) {
      const user = await repository.getUser(userId);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }
      return user;
    },

    async listUsers(input: {
      page: number;
      limit: number;
      search?: string | undefined;
      role?: UserRole | undefined;
    }) {
      const { users, total } = await repository.listUsers(input);
      return {
        users,
        pagination: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    },

    async listRoleAuditLogs(input: { page: number; limit: number }) {
      const { logs, total } = await repository.listRoleAuditLogs(input);
      return {
        logs,
        pagination: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    },

    async changeRole(actorId: string, targetId: string, role: UserRole) {
      const result = await repository.changeRole(actorId, targetId, role);
      switch (result.kind) {
        case 'changed':
          return result.audit;
        case 'unchanged':
          throw new AppError(
            'The account already has this role',
            409,
            'ROLE_UNCHANGED',
          );
        case 'not-found':
          throw new AppError('User not found', 404, 'USER_NOT_FOUND');
        case 'self-demotion':
          throw new AppError(
            'You cannot demote your own account',
            400,
            'SELF_DEMOTION',
          );
        case 'last-admin':
          throw new AppError(
            'The last administrator cannot be demoted',
            409,
            'LAST_ADMIN_REQUIRED',
          );
        case 'actor-not-admin':
          throw new AppError('Administrator access required', 403, 'FORBIDDEN');
      }
    },
  };
}
