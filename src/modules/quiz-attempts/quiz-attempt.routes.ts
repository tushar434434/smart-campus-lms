import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { QuizAttemptService } from './quiz-attempt.service.js';

interface AuthenticatedUser {
  sub: string;
  role: 'student' | 'faculty' | 'admin';
}

function parseUser(payload: unknown): AuthenticatedUser | undefined {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('sub' in payload) ||
    !('role' in payload)
  ) {
    return undefined;
  }

  const { sub, role } = payload;

  if (
    typeof sub !== 'string' ||
    !['student', 'faculty', 'admin'].includes(String(role))
  ) {
    return undefined;
  }

  return {
    sub,
    role: role as AuthenticatedUser['role'],
  };
}

async function authenticate(
  request: FastifyRequest,
): Promise<AuthenticatedUser> {
  const payload: unknown = await request.jwtVerify();
  const user = parseUser(payload);

  if (!user) {
    throw new Error('UNAUTHORIZED');
  }

  return user;
}

function requireStudent(user: AuthenticatedUser): void {
  if (user.role !== 'student') {
    throw new Error('FORBIDDEN');
  }
}

function sendError(
  error: unknown,
  reply: {
    code: (statusCode: number) => {
      send: (payload: unknown) => unknown;
    };
  },
) {
  const code = error instanceof Error ? error.message : 'INTERNAL_ERROR';

  const knownErrors: Record<string, { status: number; message: string }> = {
    UNAUTHORIZED: { status: 401, message: 'Authentication required' },
    QUIZ_NOT_FOUND: { status: 404, message: 'Quiz not found' },
    QUIZ_NOT_AVAILABLE: { status: 403, message: 'Quiz is not available' },
    QUIZ_NOT_STARTED: { status: 403, message: 'Quiz has not started' },
    QUIZ_ENDED: { status: 403, message: 'Quiz has ended' },
    NOT_ENROLLED: {
      status: 403,
      message: 'You are not enrolled in this course',
    },
    MAX_ATTEMPTS_REACHED: {
      status: 409,
      message: 'Maximum attempts reached',
    },
    ATTEMPT_NOT_FOUND: { status: 404, message: 'Attempt not found' },
    ATTEMPT_ALREADY_SUBMITTED: {
      status: 409,
      message: 'Attempt is no longer active',
    },
    QUESTION_NOT_FOUND: { status: 404, message: 'Question not found' },
    QUIZ_TIME_EXPIRED: { status: 409, message: 'Quiz time has expired' },
    FORBIDDEN: { status: 403, message: 'Access denied' },
  };

  const known = knownErrors[code];

  if (!known) {
    return reply.code(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }

  return reply.code(known.status).send({
    success: false,
    error: { code, message: known.message },
  });
}

const uuidSchema = z.string().uuid();

const answerSchema = z.object({
  selectedOption: z.enum(['A', 'B', 'C', 'D']),
});

export async function quizAttemptRoutes(
  app: FastifyInstance,
  service: QuizAttemptService,
) {
  // Start a quiz attempt.
  app.post<{ Params: { id: string } }>(
    '/quizzes/:id/attempts',
    async (request, reply) => {
      try {
        const user = await authenticate(request);
        requireStudent(user);

        const id = uuidSchema.safeParse(request.params.id);

        if (!id.success) {
          return reply.code(400).send({
            success: false,
            error: { code: 'INVALID_ID', message: 'Invalid quiz ID' },
          });
        }

        const attempt = await service.start(id.data, user.sub);

        return reply.code(201).send({ success: true, data: attempt });
      } catch (error) {
        return sendError(error, reply);
      }
    },
  );

  // Retrieve questions without correct answers.
  app.get<{ Params: { attemptId: string } }>(
    '/attempts/:attemptId/questions',
    async (request, reply) => {
      try {
        const user = await authenticate(request);
        requireStudent(user);

        const id = uuidSchema.safeParse(request.params.attemptId);

        if (!id.success) {
          return reply.code(400).send({
            success: false,
            error: { code: 'INVALID_ID', message: 'Invalid attempt ID' },
          });
        }

        const questions = await service.getQuestions(id.data, user.sub);

        return reply.send({ success: true, data: questions });
      } catch (error) {
        return sendError(error, reply);
      }
    },
  );

  // Save or update an answer.
  app.put<{
    Params: { attemptId: string; questionId: string };
    Body: { selectedOption: 'A' | 'B' | 'C' | 'D' };
  }>('/attempts/:attemptId/answers/:questionId', async (request, reply) => {
    try {
      const user = await authenticate(request);
      requireStudent(user);

      const attemptId = uuidSchema.safeParse(request.params.attemptId);
      const questionId = uuidSchema.safeParse(request.params.questionId);
      const body = answerSchema.safeParse(request.body);

      if (!attemptId.success || !questionId.success || !body.success) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid IDs or answer option',
          },
        });
      }

      await service.saveAnswer(
        {
          attemptId: attemptId.data,
          questionId: questionId.data,
          selectedOption: body.data.selectedOption,
        },
        user.sub,
      );

      return reply.send({ success: true, message: 'Answer saved' });
    } catch (error) {
      return sendError(error, reply);
    }
  });

  // Submit an attempt.
  app.post<{ Params: { attemptId: string } }>(
    '/attempts/:attemptId/submit',
    async (request, reply) => {
      try {
        const user = await authenticate(request);
        requireStudent(user);

        const id = uuidSchema.safeParse(request.params.attemptId);

        if (!id.success) {
          return reply.code(400).send({
            success: false,
            error: { code: 'INVALID_ID', message: 'Invalid attempt ID' },
          });
        }

        const attempt = await service.submit(id.data, user.sub);

        return reply.send({ success: true, data: attempt });
      } catch (error) {
        return sendError(error, reply);
      }
    },
  );
}
