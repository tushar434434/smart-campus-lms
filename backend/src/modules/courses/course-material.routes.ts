import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError } from '../../errors/app-error.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { successResponse } from '../../utils/response.js';
import { createCourseMaterialSchema } from './course-material.schema.js';
import type { createCourseMaterialService } from './course-material.service.js';

type MaterialService = ReturnType<typeof createCourseMaterialService>;
const courseIdSchema = z.string().uuid();
const materialIdSchema = z.string().uuid();

export async function courseMaterialRoutes(
  app: FastifyInstance,
  service: MaterialService,
): Promise<void> {
  app.post<{ Params: { courseId: string } }>(
    '/courses/:courseId/materials',
    { preHandler: [authenticate, authorize('faculty', 'admin')] },
    async (request, reply) => {
      const courseId = courseIdSchema.safeParse(request.params.courseId);
      const input = createCourseMaterialSchema.safeParse(request.query);
      if (!courseId.success || !input.success) {
        throw new AppError(
          'Invalid course material metadata',
          400,
          'VALIDATION_ERROR',
        );
      }
      const part = await request.file();
      if (!part) {
        throw new AppError('A material file is required', 400, 'FILE_REQUIRED');
      }
      let buffer: Buffer;
      try {
        buffer = await part.toBuffer();
      } catch {
        throw new AppError(
          'Material files cannot exceed 10 MiB',
          413,
          'FILE_TOO_LARGE',
        );
      }
      const user = request.user as { sub: string; role: 'faculty' | 'admin' };
      const material = await service.create(
        courseId.data,
        input.data,
        {
          buffer,
          mimeType: part.mimetype,
          originalFileName: part.filename,
        },
        user,
      );
      return reply
        .status(201)
        .send(successResponse('Course material uploaded', material));
    },
  );

  app.get<{ Params: { courseId: string } }>(
    '/courses/:courseId/materials',
    { preHandler: [authenticate] },
    async (request) => {
      const courseId = courseIdSchema.safeParse(request.params.courseId);
      if (!courseId.success) {
        throw new AppError('Invalid course ID', 400, 'VALIDATION_ERROR');
      }
      const user = request.user as {
        sub: string;
        role: 'student' | 'faculty' | 'admin';
      };
      return successResponse(
        'Course materials retrieved',
        await service.list(courseId.data, user),
      );
    },
  );

  app.get<{ Params: { id: string }; Querystring: { download?: string } }>(
    '/course-materials/:id/file',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const id = materialIdSchema.safeParse(request.params.id);
      if (!id.success) {
        throw new AppError('Invalid material ID', 400, 'VALIDATION_ERROR');
      }
      const user = request.user as {
        sub: string;
        role: 'student' | 'faculty' | 'admin';
      };
      const file = await service.readFile(id.data, user);
      const disposition =
        request.query.download === 'true' ? 'attachment' : 'inline';
      return reply
        .type(file.mimeType)
        .header('cache-control', 'private, no-store')
        .header('x-content-type-options', 'nosniff')
        .header(
          'content-disposition',
          `${disposition}; filename="course-material-${id.data}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        )
        .send(file.buffer);
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/course-materials/:id',
    { preHandler: [authenticate, authorize('faculty', 'admin')] },
    async (request) => {
      const id = materialIdSchema.safeParse(request.params.id);
      if (!id.success) {
        throw new AppError('Invalid material ID', 400, 'VALIDATION_ERROR');
      }
      const user = request.user as { sub: string; role: 'faculty' | 'admin' };
      await service.delete(id.data, user);
      return successResponse('Course material deleted', undefined);
    },
  );
}
