import { randomUUID } from 'node:crypto';
import type { UserRole } from '../auth/auth.schema.js';
import type {
  AdminRepository,
  AdminDashboardStats,
  AdminUser,
  RoleChangeAudit,
  RoleChangeResult,
} from './admin.repository.interface.js';

interface Account {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export class InMemoryAdminRepository implements AdminRepository {
  private readonly accounts = new Map<string, Account>();
  private readonly auditLogs: RoleChangeAudit[] = [];

  addAccount(account: Account): void {
    this.accounts.set(account.id, account);
  }

  async findRole(userId: string): Promise<UserRole | undefined> {
    return this.accounts.get(userId)?.role;
  }

  async getDashboardStats(): Promise<AdminDashboardStats> {
    const accounts = [...this.accounts.values()];
    const { logs } = await this.listRoleAuditLogs({ page: 1, limit: 5 });
    return {
      totalUsers: accounts.length,
      students: accounts.filter((account) => account.role === 'student').length,
      faculty: accounts.filter((account) => account.role === 'faculty').length,
      administrators: accounts.filter((account) => account.role === 'admin')
        .length,
      courses: 0,
      assignments: 0,
      quizzes: 0,
      recentUsers: accounts
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 5)
        .map((account) => ({ ...account })),
      recentRoleChanges: logs,
    };
  }

  async getUser(userId: string): Promise<AdminUser | undefined> {
    const account = this.accounts.get(userId);
    return account ? { ...account } : undefined;
  }

  async listUsers(input: {
    page: number;
    limit: number;
    search?: string | undefined;
    role?: UserRole | undefined;
  }): Promise<{ users: AdminUser[]; total: number }> {
    const needle = input.search?.toLocaleLowerCase();
    const users = [...this.accounts.values()]
      .filter(
        (user) =>
          (!input.role || user.role === input.role) &&
          (!needle ||
            user.name.toLocaleLowerCase().includes(needle) ||
            user.email.toLocaleLowerCase().includes(needle)),
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const start = (input.page - 1) * input.limit;
    return {
      users: users.slice(start, start + input.limit).map((user) => ({
        ...user,
      })),
      total: users.length,
    };
  }

  async listRoleAuditLogs(input: {
    page: number;
    limit: number;
  }): Promise<{ logs: RoleChangeAudit[]; total: number }> {
    const start = (input.page - 1) * input.limit;
    return {
      logs: this.auditLogs.slice(start, start + input.limit),
      total: this.auditLogs.length,
    };
  }

  async changeRole(
    actorId: string,
    targetId: string,
    role: UserRole,
  ): Promise<RoleChangeResult> {
    const actor = this.accounts.get(actorId);
    const target = this.accounts.get(targetId);
    if (actor?.role !== 'admin') return { kind: 'actor-not-admin' };
    if (!target) return { kind: 'not-found' };
    if (target.role === role) return { kind: 'unchanged' };
    if (actorId === targetId && role !== 'admin')
      return { kind: 'self-demotion' };
    if (
      target.role === 'admin' &&
      role !== 'admin' &&
      [...this.accounts.values()].filter((account) => account.role === 'admin')
        .length <= 1
    ) {
      return { kind: 'last-admin' };
    }

    const previousRole = target.role;
    target.role = role;
    const audit: RoleChangeAudit = {
      id: randomUUID(),
      actorId,
      actorName: actor.name,
      actorEmail: actor.email,
      targetId,
      targetName: target.name,
      targetEmail: target.email,
      previousRole,
      newRole: role,
      createdAt: new Date().toISOString(),
    };
    this.auditLogs.unshift(audit);
    return { kind: 'changed', audit };
  }
}
