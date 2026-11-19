import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';

import { errorHandler } from './errors/error-handler.js';
import { createContainer } from './container.js';

import { courseRoutes } from './modules/courses/course.routes.js';
import { courseMaterialRoutes } from './modules/courses/course-material.routes.js';
import { studentRoutes } from './modules/students/student.routes.js';
import { enrollmentRoutes } from './modules/enrollments/enrollment.routes.js';
import { assignmentRoutes } from './modules/assignments/assignment.routes.js';
import { submissionRoutes } from './modules/submissions/submission.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import type { AuthRepository } from './modules/auth/auth.repository.interface.js';
import { quizRoutes } from './modules/quizzes/quiz.routes.js';
import { quizAttemptRoutes } from './modules/quiz-attempts/quiz-attempt.routes.js';
import { adminRoutes } from './modules/admin/admin.routes.js';
import { passwordResetRoutes } from './modules/auth/password-reset.routes.js';
import { reportRoutes } from './modules/reports/report.routes.js';

type HealthCheckPrisma = {
  $queryRaw: (
    query: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<unknown>;
  $disconnect: () => Promise<unknown>;
};

type AppContainer = {
  prisma: HealthCheckPrisma;
  courseService: ReturnType<typeof createContainer>['courseService'];
  courseMaterialService: ReturnType<
    typeof createContainer
  >['courseMaterialService'];
  studentService: ReturnType<typeof createContainer>['studentService'];
  studentRepository: import('./modules/students/student.repository.interface.js').StudentRepository;
  enrollmentService: ReturnType<typeof createContainer>['enrollmentService'];
  assignmentService: ReturnType<typeof createContainer>['assignmentService'];
  submissionService: ReturnType<typeof createContainer>['submissionService'];
  authService: ReturnType<typeof createContainer>['authService'];
  adminService: ReturnType<typeof createContainer>['adminService'];
  passwordResetService: ReturnType<
    typeof createContainer
  >['passwordResetService'];
  authRepository: Pick<AuthRepository, 'findById'>;
  quizService: ReturnType<typeof createContainer>['quizService'];
  quizAttemptService: ReturnType<typeof createContainer>['quizAttemptService'];
  reportService?: ReturnType<typeof createContainer>['reportService'];
};

export function buildApp(container: AppContainer) {
  const isTest = process.env.NODE_ENV === 'test';
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret && !isTest) {
    throw new Error('JWT_SECRET must be configured outside test environments');
  }

  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
    requestIdHeader: false,
    genReqId: () => randomUUID(),
  });

  app.addHook('onResponse', async (request, reply) => {
    request.log.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
      },
      'Request completed',
    );
  });

  app.register(swagger, {
    openapi: {
      info: {
        title: 'Smart Campus LMS API',
        description:
          'Backend API for the Smart Campus Learning Management System',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Local development server',
        },
      ],
      tags: [
        { name: 'Health', description: 'System health endpoints' },
        { name: 'Authentication', description: 'Authentication endpoints' },
        { name: 'Courses', description: 'Course management endpoints' },
        { name: 'Students', description: 'Student management endpoints' },
        { name: 'Enrollments', description: 'Course enrollment endpoints' },
        { name: 'Assignments', description: 'Assignment management endpoints' },
        { name: 'Submissions', description: 'Assignment management endpoints' },
        { name: 'Quizzes', description: 'Quiz management endpoints' },
        {
          name: 'Quiz Attempts',
          description:
            'Starting quizzes, answering questions, and submitting attempts',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  app.register(swaggerUi, { routePrefix: '/docs' });

  app.register(jwt, {
    secret: jwtSecret ?? 'test-only-secret-not-for-production',
    sign: { expiresIn: '1h' },
  });

  app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    global: process.env.NODE_ENV !== 'test',
    errorResponseBuilder: (_request, context) => ({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many requests. Try again in ${Math.ceil(
          context.ttl / 1000,
        )} seconds.`,
      },
    }),
  });
  app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 1,
      fields: 1,
    },
  });

  app.setErrorHandler(errorHandler);

  const {
    prisma,
    courseService,
    courseMaterialService,
    studentService,
    studentRepository,
    enrollmentService,
    assignmentService,
    submissionService,
    authService,
    adminService,
    passwordResetService,
    authRepository,
    quizService,
    quizAttemptService,
    reportService,
  } = container;
  app.decorate('getCurrentUserRole', async (userId: string) => {
    const user = await authRepository.findById(userId);
    if (!user || user.suspendedAt) return undefined;
    return user.role;
  });
  app.decorate('isAccountSuspended', async (userId: string) => {
    const user = await authRepository.findById(userId);
    return Boolean(user?.suspendedAt);
  });

  app.get(
    '/health',
    {
      schema: {
        tags: ['Health'],
        summary: 'Check API and database health',
      },
    },
    async (_request, reply) => {
      try {
        await prisma.$queryRaw`SELECT 1`;

        return reply.code(200).send({
          success: true,
          message: 'Service is healthy',
          data: {
            service: 'smart-campus-lms',
            status: 'ok',
            database: 'connected',
          },
        });
      } catch {
        return reply.code(503).send({
          success: false,
          message: 'Service is unavailable',
          data: {
            service: 'smart-campus-lms',
            status: 'unavailable',
            database: 'disconnected',
          },
        });
      }
    },
  );

  app.register(courseRoutes, { service: courseService });
  app.register(async (materialApp) => {
    await courseMaterialRoutes(materialApp, courseMaterialService);
  });
  app.register(studentRoutes, { service: studentService });
  app.register(enrollmentRoutes, { service: enrollmentService });
  app.register(assignmentRoutes, { service: assignmentService });
  app.register(submissionRoutes, { service: submissionService });

  app.register(async (quizApp) => {
    await quizRoutes(quizApp, quizService);
  });

  app.register(async (attemptApp) => {
    await quizAttemptRoutes(
      attemptApp,
      quizAttemptService,
      studentRepository,
      authRepository,
    );
  });
  if (reportService) {
    app.register(async (reportApp) => {
      await reportRoutes(reportApp, reportService);
    });
  }

  app.register(authRoutes, {
    prefix: '/auth',
    service: authService,
  });
  app.register(async (adminApp) => {
    await adminRoutes(adminApp, adminService);
  });
  app.register(async (resetApp) => {
    await passwordResetRoutes(resetApp, passwordResetService);
  });

  return app;
}
