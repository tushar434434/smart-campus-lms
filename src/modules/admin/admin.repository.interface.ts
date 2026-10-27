import type { UserRole } from '../auth/auth.schema.js';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  status: 'active';
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

export type RoleChangeResult =
  | { kind: 'changed'; audit: RoleChangeAudit }
  | { kind: 'unchanged' }
  | { kind: 'not-found' }
  | { kind: 'self-demotion' }
  | { kind: 'last-admin' }
  | { kind: 'actor-not-admin' };

export interface AdminRepository {
  findRole(userId: string): Promise<UserRole | undefined>;
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
