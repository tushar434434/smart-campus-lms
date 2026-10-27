import { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import type {
  AdminRepository,
  AdminUser,
  RoleChangeAudit,
  RoleChangeResult,
} from './admin.repository.interface.js';
import type { UserRole } from '../auth/auth.schema.js';

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
} as const;

export class PrismaAdminRepository implements AdminRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findRole(userId: string): Promise<UserRole | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role;
  }

  async listUsers(input: {
    page: number;
    limit: number;
    search?: string | undefined;
    role?: UserRole | undefined;
  }): Promise<{ users: AdminUser[]; total: number }> {
    const where: Prisma.UserWhereInput = {
      ...(input.role ? { role: input.role } : {}),
      ...(input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: 'insensitive' } },
              { email: { contains: input.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: userSelect,
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      users: users.map((user) => ({
        ...user,
        createdAt: user.createdAt.toISOString(),
        status: 'active',
      })),
      total,
    };
  }

  async listRoleAuditLogs(input: {
    page: number;
    limit: number;
  }): Promise<{ logs: RoleChangeAudit[]; total: number }> {
    const [rows, total] = await Promise.all([
      this.prisma.roleAuditLog.findMany({
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { name: true, email: true } },
          target: { select: { name: true, email: true } },
        },
      }),
      this.prisma.roleAuditLog.count(),
    ]);
    return {
      logs: rows.map((row) => ({
        id: row.id,
        actorId: row.actorId,
        actorName: row.actor.name,
        actorEmail: row.actor.email,
        targetId: row.targetId,
        targetName: row.target.name,
        targetEmail: row.target.email,
        previousRole: row.previousRole,
        newRole: row.newRole,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
    };
  }

  async changeRole(
    actorId: string,
    targetId: string,
    role: UserRole,
  ): Promise<RoleChangeResult> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(78120419)`;

      const [actor, target] = await Promise.all([
        transaction.user.findUnique({
          where: { id: actorId },
          select: { role: true },
        }),
        transaction.user.findUnique({
          where: { id: targetId },
          select: userSelect,
        }),
      ]);
      if (actor?.role !== 'admin') return { kind: 'actor-not-admin' };
      if (!target) return { kind: 'not-found' };
      if (target.role === role) return { kind: 'unchanged' };
      if (actorId === targetId && role !== 'admin') {
        return { kind: 'self-demotion' };
      }
      if (target.role === 'admin' && role !== 'admin') {
        const administratorCount = await transaction.user.count({
          where: { role: 'admin' },
        });
        if (administratorCount <= 1) return { kind: 'last-admin' };
      }

      await transaction.user.update({
        where: { id: targetId },
        data: { role },
      });
      const log = await transaction.roleAuditLog.create({
        data: {
          actorId,
          targetId,
          previousRole: target.role,
          newRole: role,
        },
        include: {
          actor: { select: { name: true, email: true } },
          target: { select: { name: true, email: true } },
        },
      });
      return {
        kind: 'changed',
        audit: {
          id: log.id,
          actorId: log.actorId,
          actorName: log.actor.name,
          actorEmail: log.actor.email,
          targetId: log.targetId,
          targetName: log.target.name,
          targetEmail: log.target.email,
          previousRole: log.previousRole,
          newRole: log.newRole,
          createdAt: log.createdAt.toISOString(),
        },
      };
    });
  }
}
