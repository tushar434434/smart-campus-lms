import type { FastifyInstance } from 'fastify';

import { AppError } from '../../errors/app-error.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';

import {
  createQuizSchema,
  createQuizQuestionSchema,
  updateQuizQuestionSchema,
  updateQuizSchema,
  releaseQuizResultsSchema,
} from './quiz.schema.js';

import type { QuizService } from './quiz.service.js';

type QuizRouteUser = {
  role: 'admin' | 'faculty' | 'student';
};

type QuizParams = {
  id: string;
};

type QuestionParams = {
  id: string;
  questionId: string;
};

export async function quizRoutes(
  app: FastifyInstance,
  service: QuizService,
): Promise<void> {
  app.post(
    '/quizzes',
    { preHandler: [authenticate, authorize('faculty', 'admin')] },
    async (request, reply) => {
      const parsed = createQuizSchema.safeParse(request.body);

      if (!parsed.success) {
        throw new AppError('Invalid quiz data', 400, 'VALIDATION_ERROR');
      }

      const quiz = await service.create(parsed.data);

      return reply.code(201).send({ success: true, data: quiz });
    },
  );

  app.post(
    '/quizzes/:id/publish',
    { preHandler: [authenticate, authorize('faculty', 'admin')] },
    async (request, reply) => {
      const { id } = request.params as QuizParams;
      validateUuid(id, 'quiz');

      const quiz = await service.publish(id);

      return reply.code(200).send({ success: true, data: quiz });
    },
  );

  app.get(
    '/courses/:courseId/quizzes',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { courseId } = request.params as { courseId: string };
      validateUuid(courseId, 'course');

      const user = request.user as QuizRouteUser;
      const quizzes = await service.getAllByCourseId(courseId, user);

      return reply.code(200).send({ success: true, data: quizzes });
    },
  );

  app.get(
    '/quizzes/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params as QuizParams;
      validateUuid(id, 'quiz');

      const user = request.user as QuizRouteUser;
      const quiz = await service.getById(id, user);

      return reply.code(200).send({ success: true, data: quiz });
    },
  );

  // Create a question: faculty/admin only.
  app.post(
    '/quizzes/:id/questions',
    { preHandler: [authenticate, authorize('faculty', 'admin')] },
    async (request, reply) => {
      const { id } = request.params as QuizParams;
      validateUuid(id, 'quiz');

      const parsed = createQuizQuestionSchema.safeParse(request.body);

      if (!parsed.success) {
        throw new AppError(
          'Invalid quiz question data',
          400,
          'VALIDATION_ERROR',
        );
      }

      const question = await service.createQuestion(id, parsed.data);

      return reply.code(201).send({ success: true, data: question });
    },
  );

  // List questions: students only receive correctOption after release.
  app.get(
    '/quizzes/:id/questions',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params as QuizParams;
      validateUuid(id, 'quiz');

      const user = request.user as QuizRouteUser;
      const questions = await service.getQuestions(id, user);

      return reply.code(200).send({ success: true, data: questions });
    },
  );

  // Update a question: faculty/admin only.
  app.patch(
    '/quizzes/:id/questions/:questionId',
    { preHandler: [authenticate, authorize('faculty', 'admin')] },
    async (request, reply) => {
      const { id, questionId } = request.params as QuestionParams;
      validateUuid(id, 'quiz');
      validateUuid(questionId, 'question');

      const parsed = updateQuizQuestionSchema.safeParse(request.body);

      if (!parsed.success) {
        throw new AppError(
          'Invalid quiz question data',
          400,
          'VALIDATION_ERROR',
        );
      }

      const question = await service.updateQuestion(
        id,
        questionId,
        parsed.data,
      );

      return reply.code(200).send({ success: true, data: question });
    },
  );

  // Delete a question: faculty/admin only.
  app.delete(
    '/quizzes/:id/questions/:questionId',
    { preHandler: [authenticate, authorize('faculty', 'admin')] },
    async (request, reply) => {
      const { id, questionId } = request.params as QuestionParams;
      validateUuid(id, 'quiz');
      validateUuid(questionId, 'question');

      await service.deleteQuestion(id, questionId);

      return reply.code(200).send({
        success: true,
        message: 'Quiz question deleted successfully',
      });
    },
  );

  app.patch(
    '/quizzes/:id',
    { preHandler: [authenticate, authorize('faculty', 'admin')] },
    async (request, reply) => {
      const { id } = request.params as QuizParams;
      validateUuid(id, 'quiz');

      const parsed = updateQuizSchema.safeParse(request.body);

      if (!parsed.success) {
        throw new AppError('Invalid quiz data', 400, 'VALIDATION_ERROR');
      }

      const quiz = await service.update(id, parsed.data);

      return reply.code(200).send({ success: true, data: quiz });
    },
  );

  app.post(
    '/quizzes/:id/release-results',
    { preHandler: [authenticate, authorize('faculty', 'admin')] },
    async (request, reply) => {
      const { id } = request.params as QuizParams;
      validateUuid(id, 'quiz');

      const parsed = releaseQuizResultsSchema.safeParse(request.body);

      if (!parsed.success) {
        throw new AppError(
          'Invalid result release data',
          400,
          'VALIDATION_ERROR',
        );
      }

      const quiz = await service.releaseResults(id, parsed.data);

      return reply.code(200).send({ success: true, data: quiz });
    },
  );

  app.delete(
    '/quizzes/:id',
    { preHandler: [authenticate, authorize('admin')] },
    async (request, reply) => {
      const { id } = request.params as QuizParams;
      validateUuid(id, 'quiz');

      await service.delete(id);

      return reply.code(200).send({
        success: true,
        message: 'Quiz deleted successfully',
      });
    },
  );
}

function validateUuid(value: string, label: string): void {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new AppError(`Invalid ${label} ID`, 400, 'VALIDATION_ERROR');
  }
}
