import type { FastifyInstance } from 'fastify';
import { AppError } from '../../errors/app-error.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import type { QuizService } from './quiz.service.js';
import {
  createQuizSchema,
  releaseQuizResultsSchema,
  updateQuizSchema,
} from './quiz.schema.js';

type QuizRouteUser = {
  role: 'admin' | 'faculty' | 'student';
};

export async function quizRoutes(
  app: FastifyInstance,
  service: QuizService,
): Promise<void> {
  // Create a quiz
  app.post(
    '/quizzes',
    {
      preHandler: [authenticate, authorize('faculty', 'admin')],
    },
    async (request, reply) => {
      const parsed = createQuizSchema.safeParse(request.body);

      if (!parsed.success) {
        throw new AppError('Invalid quiz data', 400, 'VALIDATION_ERROR');
      }

      const quiz = await service.create(parsed.data);

      return reply.code(201).send({
        success: true,
        data: quiz,
      });
    },
  );

  // Get quizzes for a course
  app.get(
    '/courses/:courseId/quizzes',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { courseId } = request.params as { courseId: string };

      if (!isUuid(courseId)) {
        throw new AppError('Invalid course ID', 400, 'VALIDATION_ERROR');
      }

      const user = request.user as QuizRouteUser;
      const quizzes = await service.getAllByCourseId(courseId, user);

      return reply.code(200).send({
        success: true,
        data: quizzes,
      });
    },
  );

  // Get a quiz by ID
  app.get(
    '/quizzes/:id',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      if (!isUuid(id)) {
        throw new AppError('Invalid quiz ID', 400, 'VALIDATION_ERROR');
      }

      const user = request.user as QuizRouteUser;
      const quiz = await service.getById(id, user);

      return reply.code(200).send({
        success: true,
        data: quiz,
      });
    },
  );

  // Update a quiz
  app.patch(
    '/quizzes/:id',
    {
      preHandler: [authenticate, authorize('faculty', 'admin')],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      if (!isUuid(id)) {
        throw new AppError('Invalid quiz ID', 400, 'VALIDATION_ERROR');
      }

      const parsed = updateQuizSchema.safeParse(request.body);

      if (!parsed.success) {
        throw new AppError('Invalid quiz data', 400, 'VALIDATION_ERROR');
      }

      const quiz = await service.update(id, parsed.data);

      return reply.code(200).send({
        success: true,
        data: quiz,
      });
    },
  );

  // Release quiz results
  app.post(
    '/quizzes/:id/release-results',
    {
      preHandler: [authenticate, authorize('faculty', 'admin')],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      if (!isUuid(id)) {
        throw new AppError('Invalid quiz ID', 400, 'VALIDATION_ERROR');
      }

      const parsed = releaseQuizResultsSchema.safeParse(request.body);

      if (!parsed.success) {
        throw new AppError(
          'Invalid result release data',
          400,
          'VALIDATION_ERROR',
        );
      }

      const quiz = await service.releaseResults(id, parsed.data);

      return reply.code(200).send({
        success: true,
        data: quiz,
      });
    },
  );

  // Delete a quiz (admin only)
  app.delete(
    '/quizzes/:id',
    {
      preHandler: [authenticate, authorize('admin')],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      if (!isUuid(id)) {
        throw new AppError('Invalid quiz ID', 400, 'VALIDATION_ERROR');
      }

      await service.delete(id);

      return reply.code(200).send({
        success: true,
        message: 'Quiz deleted successfully',
      });
    },
  );
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
