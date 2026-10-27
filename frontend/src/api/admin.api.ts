import { apiRequest } from './client';
import type { Pagination, UserRole } from '../types/api';

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

export const adminApi = {
  listUsers: (
    token: string,
    input: { page: number; limit: number; search?: string; role?: UserRole },
  ) => {
    const query = new URLSearchParams({
      page: String(input.page),
      limit: String(input.limit),
    });
    if (input.search) query.set('search', input.search);
    if (input.role) query.set('role', input.role);
    return apiRequest<{ users: AdminUser[]; pagination: Pagination }>(
      `/admin/users?${query.toString()}`,
      { token },
    );
  },
  changeRole: (token: string, userId: string, role: UserRole) =>
    apiRequest<RoleChangeAudit>(
      `/admin/users/${encodeURIComponent(userId)}/role`,
      {
        method: 'PATCH',
        token,
        body: { role },
      },
    ),
  listRoleAuditLogs: (token: string, page = 1, limit = 10) =>
    apiRequest<{ logs: RoleChangeAudit[]; pagination: Pagination }>(
      `/admin/role-audit-logs?page=${page}&limit=${limit}`,
      { token },
    ),
};
