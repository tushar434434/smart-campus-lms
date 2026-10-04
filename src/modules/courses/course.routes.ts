import type { FastifyInstance } from 'fastify';

import { AppError } from '../../errors/app-error.js';
import { successResponse } from '../../utils/response.js';

import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';

import {
  createCourseSchema,
  updateCourseSchema,
  listCoursesSchema,
} from './course.schema.js';

import type { createCourseService } from './course.service.js';

type CourseRoutesOptions = {
  service: ReturnType<typeof createCourseService>;
};

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

      const course = service.createCourse(result.data);

      return reply
        .status(201)
        .send(successResponse('Course created successfully', course));
    },
  );

  // List courses: Public for now
  app.get('/courses', async (request) => {
    const result = listCoursesSchema.safeParse(request.query);

    if (!result.success) {
      throw new AppError(
        result.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join(', '),
        400,
        'VALIDATION_ERROR',
      );
    }

    const courses = service.getCourses(result.data);

    return successResponse('Courses retrieved successfully', courses);
  });

  // Get course by ID: Public for now
  app.get<{ Params: { id: string } }>('/courses/:id', async (request) => {
    const course = service.getCourseById(request.params.id);

    return successResponse('Course retrieved successfully', course);
  });

  // Update course: Faculty and Admin only
  app.patch<{ Params: { id: string } }>(
    '/courses/:id',
    {
      preHandler: [authenticate, authorize('faculty', 'admin')],
    },
    async (request) => {
      const result = updateCourseSchema.safeParse(request.body);

      if (!result.success) {
        throw new AppError(
          result.error.issues.map((issue) => issue.message).join(', '),
          400,
          'VALIDATION_ERROR',
        );
      }

      const course = service.updateCourse(request.params.id, result.data);

      return successResponse('Course updated successfully', course);
    },
  );

  // Delete course: Admin only
  app.delete<{ Params: { id: string } }>(
    '/courses/:id',
    {
      preHandler: [authenticate, authorize('admin')],
    },
    async (request) => {
      service.deleteCourse(request.params.id);

      return successResponse('Course deleted successfully', {
        id: request.params.id,
      });
    },
  );
}
