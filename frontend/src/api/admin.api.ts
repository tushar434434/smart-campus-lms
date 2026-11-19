import { apiRequest } from './client';
import type { Pagination, UserRole } from '../types/api';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  suspendedAt: string | null;
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
  getDashboardStats: (token: string) =>
    apiRequest<AdminDashboardStats>('/admin/dashboard/stats', { token }),
  getUser: (token: string, userId: string) =>
    apiRequest<AdminUser>(`/admin/users/${encodeURIComponent(userId)}`, {
      token,
    }),
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
  setSuspension: (token: string, userId: string, suspended: boolean) =>
    apiRequest<AdminUser>(
      `/admin/users/${encodeURIComponent(userId)}/suspension`,
      {
        method: 'PATCH',
        token,
        body: { suspended },
      },
    ),
  listRoleAuditLogs: (token: string, page = 1, limit = 10) =>
    apiRequest<{ logs: RoleChangeAudit[]; pagination: Pagination }>(
      `/admin/role-audit-logs?page=${page}&limit=${limit}`,
      { token },
    ),
};
