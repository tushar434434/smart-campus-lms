import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AppError } from '../../errors/app-error.js';
import { authenticate } from '../../middleware/authenticate.js';
import { successResponse } from '../../utils/response.js';
import type { createAdminService } from './admin.service.js';

type AdminService = ReturnType<typeof createAdminService>;
const userRoleSchema = z.enum(['student', 'faculty', 'admin']);
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
const listUsersSchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  role: userRoleSchema.optional(),
});
const roleChangeSchema = z.object({ role: userRoleSchema });
const userIdSchema = z.string().uuid();

function validationError(error: z.ZodError): AppError {
  return new AppError(
    error.issues.map((issue) => issue.message).join(', '),
    400,
    'VALIDATION_ERROR',
  );
}

export async function adminRoutes(app: FastifyInstance, service: AdminService) {
  const requireCurrentAdmin = async (request: FastifyRequest) => {
    const user = request.user as { sub: string };
    await service.requireAdmin(user.sub);
  };

  app.get(
    '/admin/dashboard/stats',
    { preHandler: [authenticate, requireCurrentAdmin] },
    async () =>
      successResponse(
        'Dashboard statistics retrieved successfully',
        await service.getDashboardStats(),
      ),
  );

  app.get<{ Params: { userId: string } }>(
    '/admin/users/:userId',
    { preHandler: [authenticate, requireCurrentAdmin] },
    async (request) => {
      const id = userIdSchema.safeParse(request.params.userId);
      if (!id.success) throw validationError(id.error);
      return successResponse(
        'User retrieved successfully',
        await service.getUser(id.data),
      );
    },
  );

  app.get(
    '/admin/users',
    {
      preHandler: [authenticate, requireCurrentAdmin],
    },
    async (request) => {
      const parsed = listUsersSchema.safeParse(request.query);
      if (!parsed.success) throw validationError(parsed.error);
      const result = await service.listUsers(parsed.data);
      return successResponse('Users retrieved successfully', result);
    },
  );

  app.patch<{ Params: { userId: string } }>(
    '/admin/users/:userId/role',
    { preHandler: [authenticate, requireCurrentAdmin] },
    async (request) => {
      const id = userIdSchema.safeParse(request.params.userId);
      if (!id.success) throw validationError(id.error);
      const body = roleChangeSchema.safeParse(request.body);
      if (!body.success) throw validationError(body.error);
      const user = request.user as { sub: string };
      const audit = await service.changeRole(user.sub, id.data, body.data.role);
      return successResponse('User role updated successfully', audit);
    },
  );

  app.get(
    '/admin/role-audit-logs',
    {
      preHandler: [authenticate, requireCurrentAdmin],
    },
    async (request) => {
      const parsed = paginationSchema.safeParse(request.query);
      if (!parsed.success) throw validationError(parsed.error);
      const result = await service.listRoleAuditLogs(parsed.data);
      return successResponse(
        'Role audit history retrieved successfully',
        result,
      );
    },
  );
}
