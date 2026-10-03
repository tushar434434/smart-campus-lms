import type { FastifyInstance } from 'fastify';
import { AppError } from '../../errors/app-error.js';
import { successResponse } from '../../utils/response.js';
import { createCourseSchema } from './course.schema.js';
import { createCourse, getCourseById, getCourses } from './course.service.js';

export async function courseRoutes(app: FastifyInstance) {
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

  app.get('/courses', async () => {
    return successResponse('Courses retrieved successfully', getCourses());
  });
  app.get<{ Params: { id: string } }>(
    '/courses/:id',
    async (request) => {
      const course = getCourseById(request.params.id);

      if (!course) {
        throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
      }

      return successResponse('Course retrieved successfully', course);
    },
  );
}
