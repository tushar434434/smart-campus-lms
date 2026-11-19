import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { AppError } from '../../errors/app-error.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { successResponse } from '../../utils/response.js';

import {
  createCourseSchema,
  updateCourseSchema,
  listCoursesSchema,
} from './course.schema.js';

import type { createCourseService } from './course.service.js';

type CourseRoutesOptions = {
  service: ReturnType<typeof createCourseService>;
};

type CourseParams = {
  id: string;
};

const uuidPattern =
  '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$';

const courseIdSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: {
      type: 'string',
      pattern: uuidPattern,
    },
  },
} as const;
const courseOwnerSchema = z.object({
  facultyId: z.string().uuid().nullable(),
});
const rejectionSchema = z.object({
  reason: z.string().trim().min(5).max(1000),
});

export async function courseRoutes(
  app: FastifyInstance,
  { service }: CourseRoutesOptions,
) {
  // Create course: Faculty and Admin only
  app.post(
    '/courses',
    {
      preHandler: [authenticate, authorize('faculty', 'admin')],
    },
    async (request, reply) => {
      const result = createCourseSchema.safeParse(request.body);

      if (!result.success) {
        throw new AppError(
          result.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join(', '),
          400,
          'VALIDATION_ERROR',
        );
      }

      const user = request.user as { sub: string; role: 'faculty' | 'admin' };
      const course = await service.create(
        result.data,
        user.role === 'faculty' ? user.sub : undefined,
      );

      return reply
        .code(201)
        .send(successResponse('Course created successfully', course));
    },
  );

  // List courses: Public
  app.get('/courses', async (request) => {
    const result = listCoursesSchema.safeParse(request.query);

    if (!result.success) {
      throw new AppError(
        'Invalid course query parameters',
        400,
        'VALIDATION_ERROR',
      );
    }

    const courses = await service.list(result.data);

    return successResponse('Courses retrieved successfully', courses);
  });

  app.get(
    '/courses/teaching',
    {
      preHandler: [authenticate, authorize('faculty')],
    },
    async (request) => {
      const result = listCoursesSchema.safeParse(request.query);
      if (!result.success) {
        throw new AppError(
          'Invalid course query parameters',
          400,
          'VALIDATION_ERROR',
        );
      }
      const user = request.user as { sub: string };
      const courses = await service.list(result.data, user.sub);
      return successResponse(
        'Assigned courses retrieved successfully',
        courses,
      );
    },
  );

  app.get(
    '/admin/courses/pending-approval',
    { preHandler: [authenticate, authorize('admin')] },
    async (request) => {
      const result = listCoursesSchema.safeParse(request.query);
      if (!result.success) {
        throw new AppError(
          'Invalid course query parameters',
          400,
          'VALIDATION_ERROR',
        );
      }
      const courses = await service.list(result.data, undefined, 'pending');
      return successResponse('Pending courses retrieved successfully', courses);
    },
  );

  app.post<{ Params: CourseParams }>(
    '/admin/courses/:id/approve',
    { preHandler: [authenticate, authorize('admin')] },
    async (request) => {
      const user = request.user as { sub: string };
      const course = await service.approve(request.params.id, user.sub);
      return successResponse('Course approved successfully', course);
    },
  );

  app.post<{ Params: CourseParams; Body: { reason: string } }>(
    '/admin/courses/:id/reject',
    {
      preHandler: [authenticate, authorize('admin')],
      schema: { params: courseIdSchema },
    },
    async (request) => {
      const parsed = rejectionSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError(
          'A rejection reason between 5 and 1000 characters is required',
          400,
          'VALIDATION_ERROR',
        );
      }
      const user = request.user as { sub: string };
      const course = await service.reject(
        request.params.id,
        user.sub,
        parsed.data.reason,
      );
      return successResponse('Course rejected', course);
    },
  );

  app.post<{ Params: CourseParams }>(
    '/courses/:id/resubmit',
    {
      preHandler: [authenticate, authorize('faculty')],
      schema: { params: courseIdSchema },
    },
    async (request) => {
      const user = request.user as { sub: string };
      const course = await service.resubmit(request.params.id, user.sub);
      return successResponse('Course resubmitted for approval', course);
    },
  );

  app.patch<{ Params: CourseParams }>(
    '/courses/:id/owner',
    {
      preHandler: [authenticate, authorize('admin')],
      schema: { params: courseIdSchema },
    },
    async (request) => {
      const parsed = courseOwnerSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError(
          'A valid faculty ID or null is required',
          400,
          'VALIDATION_ERROR',
        );
      }

      const course = await service.assignFaculty(
        request.params.id,
        parsed.data.facultyId,
      );
      return successResponse('Course owner updated successfully', course);
    },
  );

  // Get course by ID: Public
  app.get<{ Params: CourseParams }>(
    '/courses/:id',
    {
      preHandler: [authenticate],
      schema: {
        params: courseIdSchema,
      },
    },
    async (request) => {
      const user = request.user as { sub: string; role: string };
      const course = await service.getById(request.params.id, user);

      return successResponse('Course retrieved successfully', course);
    },
  );

  // Update course: Faculty and Admin only
  app.patch<{ Params: CourseParams }>(
    '/courses/:id',
    {
      preHandler: [authenticate, authorize('faculty', 'admin')],
      schema: {
        params: courseIdSchema,
      },
    },
    async (request) => {
      const result = updateCourseSchema.safeParse(request.body);

      if (!result.success) {
        throw new AppError(
          result.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join(', '),
          400,
          'VALIDATION_ERROR',
        );
      }

      const user = request.user as { sub: string; role: 'faculty' | 'admin' };
      await service.assertCanManage(request.params.id, user);
      const course = await service.update(request.params.id, result.data);

      return successResponse('Course updated successfully', course);
    },
  );

  // Delete course: Admin only
  app.delete<{ Params: CourseParams }>(
    '/courses/:id',
    {
      preHandler: [authenticate, authorize('admin')],
      schema: {
        params: courseIdSchema,
      },
    },
    async (request) => {
      // Fetch first so the deleted course can be returned in the response.
      const user = request.user as { sub: string; role: string };
      const course = await service.getById(request.params.id, user);

      await service.delete(request.params.id);

      return successResponse('Course deleted successfully', course);
    },
  );
}
