import type { FastifyInstance } from 'fastify';

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

      const course = await service.create(result.data);

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

  // Get course by ID: Public
  app.get<{ Params: CourseParams }>(
    '/courses/:id',
    {
      schema: {
        params: courseIdSchema,
      },
    },
    async (request) => {
      const course = await service.getById(request.params.id);

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
      const course = await service.getById(request.params.id);

      await service.delete(request.params.id);

      return successResponse('Course deleted successfully', course);
    },
  );
}
