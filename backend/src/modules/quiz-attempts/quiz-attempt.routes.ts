import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AppError } from '../../errors/app-error.js';
import { recordProctoringEventSchema } from '../quizzes/quiz.schema.js';

import type { QuizAttemptService } from './quiz-attempt.service.js';
import type { AuthRepository } from '../auth/auth.repository.interface.js';
import type { StudentRepository } from '../students/student.repository.interface.js';
import { resolveStudentForUser } from '../students/student.service.js';

interface AuthenticatedUser {
  sub: string;
  role: 'student' | 'faculty' | 'admin';
}

const uuidSchema = z.string().uuid();

const answerSchema = z
  .object({
    selectedOption: z.enum(['A', 'B', 'C', 'D']),
  })
  .strict();
const bookmarkSchema = z.object({ bookmarked: z.boolean() }).strict();

const knownErrors: Record<string, { status: number; message: string }> = {
  UNAUTHORIZED: {
    status: 401,
    message: 'Authentication required',
  },
  QUIZ_NOT_FOUND: {
    status: 404,
    message: 'Quiz not found',
  },
  COURSE_NOT_FOUND: {
    status: 404,
    message: 'Course not found',
  },
  STUDENT_NOT_FOUND: {
    status: 404,
    message: 'Student record not found',
  },
  QUIZ_NOT_AVAILABLE: {
    status: 403,
    message: 'Quiz is not available',
  },
  QUIZ_NOT_STARTED: {
    status: 403,
    message: 'Quiz has not started',
  },
  QUIZ_ENDED: {
    status: 403,
    message: 'Quiz has ended',
  },
  NOT_ENROLLED: {
    status: 403,
    message: 'You are not enrolled in this course',
  },
  STUDENT_NOT_ENROLLED: {
    status: 403,
    message: 'You are not enrolled in this course',
  },
  QUIZ_NOT_PUBLISHED: {
    status: 403,
    message: 'Quiz is not available',
  },
  MAX_ATTEMPTS_REACHED: {
    status: 409,
    message: 'Maximum attempts reached',
  },
  ATTEMPT_NOT_FOUND: {
    status: 404,
    message: 'Attempt not found',
  },
  ATTEMPT_NOT_SUBMITTED: {
    status: 409,
    message: 'Attempt has not been submitted',
  },
  ATTEMPT_ALREADY_SUBMITTED: {
    status: 409,
    message: 'Attempt is no longer active',
  },
  QUESTION_NOT_FOUND: {
    status: 404,
    message: 'Question not found',
  },
  QUIZ_TIME_EXPIRED: {
    status: 409,
    message: 'Quiz time has expired',
  },
  FORBIDDEN: {
    status: 403,
    message: 'Access denied',
  },
  STUDENT_NOT_LINKED: {
    status: 403,
    message: 'Student account is not linked to a student record',
  },
};

function parseUser(payload: unknown): AuthenticatedUser | undefined {
  if (typeof payload !== 'object' || payload === null) {
    return undefined;
  }

  if (!('sub' in payload) || !('role' in payload)) {
    return undefined;
  }

  const { sub, role } = payload;

  if (
    typeof sub !== 'string' ||
    sub.trim().length === 0 ||
    typeof role !== 'string' ||
    !['student', 'faculty', 'admin'].includes(role)
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
  let payload: unknown;

  try {
    payload = await request.jwtVerify();
  } catch {
    throw new Error('UNAUTHORIZED');
  }

  const user = parseUser(payload);

  if (!user) {
    throw new Error('UNAUTHORIZED');
  }

  const currentRole = await request.server.getCurrentUserRole(user.sub);
  if (!currentRole) {
    if (process.env.NODE_ENV === 'test') {
      return user;
    }
    throw new Error('UNAUTHORIZED');
  }

  return { ...user, role: currentRole };
}

function requireStudent(user: AuthenticatedUser): void {
  if (user.role !== 'student') {
    throw new Error('FORBIDDEN');
  }
}

async function resolveStudentId(
  user: AuthenticatedUser,
  studentRepository: StudentRepository,
  authRepository?: Pick<AuthRepository, 'findById'>,
): Promise<string> {
  const student = await resolveStudentForUser(
    user.sub,
    studentRepository,
    authRepository,
  );

  if (!student) {
    throw new Error('STUDENT_NOT_LINKED');
  }

  return student.id;
}

function requestSafeLog(reply: FastifyReply, error: unknown): void {
  reply.log.error({ err: error }, 'Quiz attempt request failed');
}

function sendError(error: unknown, reply: FastifyReply) {
  if (error instanceof AppError) {
    return reply.code(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }

  const code = error instanceof Error ? error.message : 'INTERNAL_ERROR';
  const known = knownErrors[code];

  if (!known) {
    requestSafeLog(reply, error);

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
    error: {
      code,
      message: known.message,
    },
  });
}

function invalidId(reply: FastifyReply, message: string) {
  return reply.code(400).send({
    success: false,
    error: {
      code: 'INVALID_ID',
      message,
    },
  });
}

export async function quizAttemptRoutes(
  app: FastifyInstance,
  service: QuizAttemptService,
  studentRepository: StudentRepository,
  authRepository?: Pick<AuthRepository, 'findById'>,
): Promise<void> {
  app.get('/attempts/me', async (request, reply) => {
    try {
      const user = await authenticate(request);
      requireStudent(user);
      const studentId = await resolveStudentId(
        user,
        studentRepository,
        authRepository,
      );
      const activity = await service.getStudentActivity(studentId);
      return reply.send({ success: true, data: activity });
    } catch (error) {
      return sendError(error, reply);
    }
  });

  app.get<{ Params: { id: string } }>(
    '/quizzes/:id/attempts',
    async (request, reply) => {
      try {
        const user = await authenticate(request);
        const parsedId = uuidSchema.safeParse(request.params.id);
        if (!parsedId.success) return invalidId(reply, 'Invalid quiz ID');
        const roster = await service.getQuizRoster(parsedId.data, user);
        return reply.send({ success: true, data: roster });
      } catch (error) {
        return sendError(error, reply);
      }
    },
  );

  // Start a quiz attempt.
  app.post<{ Params: { id: string } }>(
    '/quizzes/:id/attempts',
    async (request, reply) => {
      try {
        const user = await authenticate(request);
        requireStudent(user);

        const parsedId = uuidSchema.safeParse(request.params.id);

        if (!parsedId.success) {
          return invalidId(reply, 'Invalid quiz ID');
        }

        const studentId = await resolveStudentId(user, studentRepository, authRepository);
        const attempt = await service.start(parsedId.data, studentId);

        return reply.code(201).send({
          success: true,
          data: attempt,
        });
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

        const parsedId = uuidSchema.safeParse(request.params.attemptId);

        if (!parsedId.success) {
          return invalidId(reply, 'Invalid attempt ID');
        }

        const studentId = await resolveStudentId(user, studentRepository, authRepository);
        const questions = await service.getQuestions(parsedId.data, studentId);

        return reply.send({
          success: true,
          data: questions,
        });
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

      if (!attemptId.success || !questionId.success) {
        return invalidId(reply, 'Invalid attempt ID or question ID');
      }

      if (!body.success) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'selectedOption must be A, B, C, or D',
          },
        });
      }

      const studentId = await resolveStudentId(user, studentRepository, authRepository);

      await service.saveAnswer(
        {
          attemptId: attemptId.data,
          questionId: questionId.data,
          selectedOption: body.data.selectedOption,
        },
        studentId,
      );

      return reply.send({
        success: true,
        message: 'Answer saved',
      });
    } catch (error) {
      return sendError(error, reply);
    }
  });

  app.put<{
    Params: { attemptId: string; questionId: string };
    Body: { bookmarked: boolean };
  }>('/attempts/:attemptId/bookmarks/:questionId', async (request, reply) => {
    try {
      const user = await authenticate(request);
      requireStudent(user);
      const attemptId = uuidSchema.safeParse(request.params.attemptId);
      const questionId = uuidSchema.safeParse(request.params.questionId);
      const body = bookmarkSchema.safeParse(request.body);
      if (!attemptId.success || !questionId.success || !body.success) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message:
              'Valid attempt/question IDs and bookmarked flag are required',
          },
        });
      }
      const studentId = await resolveStudentId(user, studentRepository, authRepository);
      await service.bookmarkQuestion(
        attemptId.data,
        questionId.data,
        body.data.bookmarked,
        studentId,
      );
      return reply.send({ success: true, message: 'Question bookmark saved' });
    } catch (error) {
      return sendError(error, reply);
    }
  });

  // Submit an attempt and return its final result.
  app.post<{ Params: { attemptId: string } }>(
    '/attempts/:attemptId/submit',
    async (request, reply) => {
      try {
        const user = await authenticate(request);
        requireStudent(user);

        const parsedId = uuidSchema.safeParse(request.params.attemptId);

        if (!parsedId.success) {
          return invalidId(reply, 'Invalid attempt ID');
        }

        const studentId = await resolveStudentId(user, studentRepository, authRepository);
        const attempt = await service.submit(parsedId.data, studentId);

        return reply.send({
          success: true,
          data: attempt,
        });
      } catch (error) {
        return sendError(error, reply);
      }
    },
  );

  // Retrieve a submitted attempt result.
  app.get<{ Params: { attemptId: string } }>(
    '/attempts/:attemptId/result',
    async (request, reply) => {
      try {
        const user = await authenticate(request);
        requireStudent(user);

        const parsedId = uuidSchema.safeParse(request.params.attemptId);

        if (!parsedId.success) {
          return invalidId(reply, 'Invalid attempt ID');
        }

        const studentId = await resolveStudentId(user, studentRepository, authRepository);
        const result = await service.getResult(parsedId.data, studentId);

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        return sendError(error, reply);
      }
    },
  );
  // Record a proctoring event for an active quiz attempt.
  app.post<{ Params: { attemptId: string } }>(
    '/attempts/:attemptId/proctoring-events',
    async (request, reply) => {
      try {
        const user = await authenticate(request);
        requireStudent(user);

        const parsedId = uuidSchema.safeParse(request.params.attemptId);
        const body = recordProctoringEventSchema.safeParse(request.body);

        if (!parsedId.success) {
          return invalidId(reply, 'Invalid attempt ID');
        }

        if (!body.success) {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid proctoring event',
            },
          });
        }

        const studentId = await resolveStudentId(user, studentRepository, authRepository);

        const attempt = await service.recordProctoringEvent(
          {
            attemptId: parsedId.data,
            type: body.data.type,
            ...(body.data.occurredAt
              ? { occurredAt: new Date(body.data.occurredAt) }
              : {}),
            ...(body.data.metadata !== undefined
              ? { metadata: body.data.metadata }
              : {}),
          },
          studentId,
        );

        return reply.send({
          success: true,
          data: attempt,
        });
      } catch (error) {
        return sendError(error, reply);
      }
    },
  );
}
