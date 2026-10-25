import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { QuizAttemptService } from './quiz-attempt.service.js';
import type { StudentRepository } from '../students/student.repository.interface.js';

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

const knownErrors: Record<string, { status: number; message: string }> = {
  UNAUTHORIZED: {
    status: 401,
    message: 'Authentication required',
  },
  QUIZ_NOT_FOUND: {
    status: 404,
    message: 'Quiz not found',
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
  MAX_ATTEMPTS_REACHED: {
    status: 409,
    message: 'Maximum attempts reached',
  },
  ATTEMPT_NOT_FOUND: {
    status: 404,
    message: 'Attempt not found',
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

  return user;
}

function requireStudent(user: AuthenticatedUser): void {
  if (user.role !== 'student') {
    throw new Error('FORBIDDEN');
  }
}

async function resolveStudentId(
  user: AuthenticatedUser,
  studentRepository: StudentRepository,
): Promise<string> {
  const student = await studentRepository.findByUserId(user.sub);

  if (!student) {
    throw new Error('STUDENT_NOT_LINKED');
  }

  return student.id;
}

function requestSafeLog(reply: FastifyReply, error: unknown): void {
  reply.log.error({ err: error }, 'Quiz attempt request failed');
}

function sendError(error: unknown, reply: FastifyReply) {
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
): Promise<void> {
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

        const studentId = await resolveStudentId(user, studentRepository);
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

        const studentId = await resolveStudentId(user, studentRepository);
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

      const studentId = await resolveStudentId(user, studentRepository);

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

        const studentId = await resolveStudentId(user, studentRepository);
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
}
