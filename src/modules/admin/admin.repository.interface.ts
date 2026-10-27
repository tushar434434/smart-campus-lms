import type { UserRole } from '../auth/auth.schema.js';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface RoleChangeAudit {
  id: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  targetId: string;
  targetName: string;
  targetEmail: string;
  previousRole: UserRole;
  newRole: UserRole;
  createdAt: string;
}

export interface AdminDashboardStats {
  totalUsers: number;
  students: number;
  faculty: number;
  administrators: number;
  courses: number;
  assignments: number;
  quizzes: number;
  recentUsers: AdminUser[];
  recentRoleChanges: RoleChangeAudit[];
}

export type RoleChangeResult =
  | { kind: 'changed'; audit: RoleChangeAudit }
  | { kind: 'unchanged' }
  | { kind: 'not-found' }
  | { kind: 'self-demotion' }
  | { kind: 'last-admin' }
  | { kind: 'actor-not-admin' };

export interface AdminRepository {
  findRole(userId: string): Promise<UserRole | undefined>;
  getDashboardStats(): Promise<AdminDashboardStats>;
  getUser(userId: string): Promise<AdminUser | undefined>;
  listUsers(input: {
    page: number;
    limit: number;
    search?: string | undefined;
    role?: UserRole | undefined;
  }): Promise<{ users: AdminUser[]; total: number }>;
  listRoleAuditLogs(input: {
    page: number;
    limit: number;
  }): Promise<{ logs: RoleChangeAudit[]; total: number }>;
  changeRole(
    actorId: string,
    targetId: string,
    role: UserRole,
  ): Promise<RoleChangeResult>;
}
