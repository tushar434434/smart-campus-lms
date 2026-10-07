import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { errorHandler } from './errors/error-handler.js';
import { createContainer } from './container.js';

// Routes
import { courseRoutes } from './modules/courses/course.routes.js';
import { studentRoutes } from './modules/students/student.routes.js';
import { enrollmentRoutes } from './modules/enrollments/enrollment.routes.js';
import { assignmentRoutes } from './modules/assignments/assignment.routes.js';
import { submissionRoutes } from './modules/submissions/submission.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';

export function buildApp(container = createContainer()) {
  const app = Fastify({
    logger: true,
  });

  // Swagger / OpenAPI
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
        {
          name: 'Authentication',
          description: 'Authentication endpoints',
        },
        {
          name: 'Courses',
          description: 'Course management endpoints',
        },
        {
          name: 'Students',
          description: 'Student management endpoints',
        },
        {
          name: 'Enrollments',
          description: 'Course enrollment endpoints',
        },
        {
          name: 'Assignments',
          description: 'Assignment management endpoints',
        },
        {
          name: 'Submissions',
          description: 'Assignment submission endpoints',
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

  app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  // JWT configuration
  app.register(jwt, {
    secret:
      process.env.JWT_SECRET ??
      'development-only-secret-change-before-deployment',
    sign: {
      expiresIn: '1h',
    },
  });

  // Global error handler
  app.setErrorHandler(errorHandler);

  // Dependency container
  const {
    courseService,
    studentService,
    enrollmentService,
    assignmentService,
    submissionService,
    authService,
  } = container;

  // Health check
  app.get(
    '/health',
    {
      schema: {
        tags: ['Health'],
        summary: 'Check API health',
      },
    },
    async () => {
      return {
        success: true,
        message: 'Service is healthy',
        data: {
          service: 'smart-campus-lms',
          status: 'ok',
        },
      };
    },
  );

  // Course routes
  app.register(courseRoutes, {
    service: courseService,
  });

  // Student routes
  app.register(studentRoutes, {
    service: studentService,
  });

  // Enrollment routes
  app.register(enrollmentRoutes, {
    service: enrollmentService,
  });

  // Assignment routes
  app.register(assignmentRoutes, {
    service: assignmentService,
  });

  // Submission routes
  app.register(submissionRoutes, {
    service: submissionService,
  });

  // Authentication routes
  app.register(authRoutes, {
    prefix: '/auth',
    service: authService,
  });

  return app;
}