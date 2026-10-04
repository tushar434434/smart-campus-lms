import type { FastifyInstance } from 'fastify';

import { AppError } from '../../errors/app-error.js';
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

export async function courseRoutes(
  app: FastifyInstance,
  { service }: CourseRoutesOptions,
) {
  app.post('/courses', async (request, reply) => {
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
  });

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

  app.get<{ Params: { id: string } }>('/courses/:id', async (request) => {
    const course = service.getCourseById(request.params.id);

    return successResponse('Course retrieved successfully', course);
  });

  app.patch<{ Params: { id: string } }>('/courses/:id', async (request) => {
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
  });

  app.delete<{ Params: { id: string } }>('/courses/:id', async (request) => {
    service.deleteCourse(request.params.id);

    return successResponse('Course deleted successfully', {
      id: request.params.id,
    });
  });
}
