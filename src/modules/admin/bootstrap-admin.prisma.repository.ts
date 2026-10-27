import bcrypt from 'bcrypt';
import { PrismaClient } from '../../generated/prisma/client.js';
import type {
  BootstrapAdminRepository,
  BootstrapAdminResult,
} from './bootstrap-admin.service.js';

export class PrismaBootstrapAdminRepository implements BootstrapAdminRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async promoteFirstAdmin(
    email: string,
    currentPassword: string,
  ): Promise<BootstrapAdminResult> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(78120419)`;
      if (await transaction.user.count({ where: { role: 'admin' } })) {
        return 'already-provisioned';
      }

      const user = await transaction.user.findUnique({
        where: { email },
        select: { id: true, passwordHash: true, role: true },
      });
      if (!user) return 'account-not-found';
      if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
        return 'invalid-credentials';
      }

      await transaction.user.update({
        where: { id: user.id },
        data: { role: 'admin' },
      });
      await transaction.roleAuditLog.create({
        data: {
          actorId: user.id,
          targetId: user.id,
          previousRole: user.role,
          newRole: 'admin',
        },
      });
      return 'promoted';
    });
  }
}
