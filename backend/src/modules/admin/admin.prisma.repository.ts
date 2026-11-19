import { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import type {
  AdminRepository,
  AdminDashboardStats,
  AdminUser,
  RoleChangeAudit,
  RoleChangeResult,
  SuspensionResult,
} from './admin.repository.interface.js';
import type { UserRole } from '../auth/auth.schema.js';

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  suspendedAt: true,
  createdAt: true,
} as const;

function toAdminUser(user: {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  suspendedAt: Date | null;
  createdAt: Date;
}): AdminUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    suspendedAt: user.suspendedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

export class PrismaAdminRepository implements AdminRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findRole(userId: string): Promise<UserRole | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role;
  }

  async getDashboardStats(): Promise<AdminDashboardStats> {
    const [
      totalUsers,
      students,
      faculty,
      administrators,
      courses,
      assignments,
      quizzes,
      recentUsers,
      recentAudit,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: 'student' } }),
      this.prisma.user.count({ where: { role: 'faculty' } }),
      this.prisma.user.count({ where: { role: 'admin' } }),
      this.prisma.course.count(),
      this.prisma.assignment.count(),
      this.prisma.quiz.count(),
      this.prisma.user.findMany({
        select: userSelect,
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
      this.listRoleAuditLogs({ page: 1, limit: 5 }),
    ]);

    return {
      totalUsers,
      students,
      faculty,
      administrators,
      courses,
      assignments,
      quizzes,
      recentUsers: recentUsers.map(toAdminUser),
      recentRoleChanges: recentAudit.logs,
    };
  }

  async getUser(userId: string): Promise<AdminUser | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });
    if (!user) return undefined;
    return toAdminUser(user);
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
      users: users.map(toAdminUser),
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
        kind: 'changed' as const,
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

  async setSuspension(
    actorId: string,
    targetId: string,
    suspended: boolean,
  ): Promise<SuspensionResult> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(78120419)`;
      const [actor, target] = await Promise.all([
        transaction.user.findUnique({
          where: { id: actorId },
          select: { role: true, suspendedAt: true },
        }),
        transaction.user.findUnique({
          where: { id: targetId },
          select: userSelect,
        }),
      ]);
      if (actor?.role !== 'admin' || actor.suspendedAt) {
        return { kind: 'actor-not-admin' };
      }
      if (!target) return { kind: 'not-found' };
      if (actorId === targetId) return { kind: 'self-suspend' };
      const currentlySuspended = target.suspendedAt !== null;
      if (currentlySuspended === suspended) return { kind: 'unchanged' };
      if (suspended && target.role === 'admin') {
        const activeAdministrators = await transaction.user.count({
          where: { role: 'admin', suspendedAt: null },
        });
        if (activeAdministrators <= 1) return { kind: 'last-admin' };
      }

      const updated = await transaction.user.update({
        where: { id: targetId },
        data: { suspendedAt: suspended ? new Date() : null },
        select: userSelect,
      });
      return { kind: 'changed', user: toAdminUser(updated) };
    });
  }
}
