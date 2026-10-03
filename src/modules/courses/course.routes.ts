import type { FastifyInstance } from 'fastify';
import { AppError } from '../../errors/app-error.js';
import { successResponse } from '../../utils/response.js';
import { createCourseSchema, updateCourseSchema } from './course.schema.js';
import {
  createCourse,
  getCourseById,
  getCourses,
  updateCourse,
} from './course.service.js';

export async function courseRoutes(app: FastifyInstance) {
  // Create a new course
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

    const course = createCourse(result.data);

    return reply
      .status(201)
      .send(successResponse('Course created successfully', course));
  });

  // Retrieve all courses
  app.get('/courses', async () => {
    return successResponse('Courses retrieved successfully', getCourses());
  });

  // Retrieve a course by ID
  app.get<{ Params: { id: string } }>('/courses/:id', async (request) => {
    const course = getCourseById(request.params.id);

    if (!course) {
      throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
    }

    return successResponse('Course retrieved successfully', course);
  });

  // Update a course
  app.patch<{ Params: { id: string } }>('/courses/:id', async (request) => {
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

    const course = updateCourse(request.params.id, result.data);

    if (!course) {
      throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
    }

    return successResponse('Course updated successfully', course);
  });
}
