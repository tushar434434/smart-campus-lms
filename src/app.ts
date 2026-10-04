import Fastify from 'fastify';
import jwt from '@fastify/jwt';

import { errorHandler } from './errors/error-handler.js';

// Routes
import { courseRoutes } from './modules/courses/course.routes.js';
import { studentRoutes } from './modules/students/student.routes.js';
import { enrollmentRoutes } from './modules/enrollments/enrollment.routes.js';
import { assignmentRoutes } from './modules/assignments/assignment.routes.js';
import { submissionRoutes } from './modules/submissions/submission.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';

// Repositories
import { InMemoryCourseRepository } from './modules/courses/course.repository.js';
import { InMemoryStudentRepository } from './modules/students/student.repository.js';
import { InMemoryEnrollmentRepository } from './modules/enrollments/enrollment.repository.js';
import { InMemoryAssignmentRepository } from './modules/assignments/assignment.repository.js';
import { InMemorySubmissionRepository } from './modules/submissions/submission.repository.js';
import { InMemoryAuthRepository } from './modules/auth/auth.repository.js';

// Services
import { createCourseService } from './modules/courses/course.service.js';
import { createStudentService } from './modules/students/student.service.js';
import { createEnrollmentService } from './modules/enrollments/enrollment.service.js';
import { createAssignmentService } from './modules/assignments/assignment.service.js';
import { createSubmissionService } from './modules/submissions/submission.service.js';
import { createAuthService } from './modules/auth/auth.service.js';

export function buildApp() {
  const app = Fastify({
    logger: true,
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

  // Repositories
  const courseRepository = new InMemoryCourseRepository();
  const studentRepository = new InMemoryStudentRepository();
  const enrollmentRepository = new InMemoryEnrollmentRepository();
  const assignmentRepository = new InMemoryAssignmentRepository();
  const submissionRepository = new InMemorySubmissionRepository();
  const authRepository = new InMemoryAuthRepository();

  // Services
  const courseService = createCourseService(courseRepository);

  const studentService = createStudentService(studentRepository);

  const enrollmentService = createEnrollmentService(
    enrollmentRepository,
    studentRepository,
    courseRepository,
  );

  const assignmentService = createAssignmentService(
    assignmentRepository,
    courseRepository,
  );

  const submissionService = createSubmissionService(
    submissionRepository,
    studentRepository,
    assignmentRepository,
  );

  const authService = createAuthService(authRepository);

  // Health check
  app.get('/health', async () => {
    return {
      success: true,
      message: 'Service is healthy',
      data: {
        service: 'smart-campus-lms',
        status: 'ok',
      },
    };
  });

  // Existing routes
  app.register(courseRoutes, {
    service: courseService,
  });

  app.register(studentRoutes, {
    service: studentService,
  });

  app.register(enrollmentRoutes, {
    service: enrollmentService,
  });

  app.register(assignmentRoutes, {
    service: assignmentService,
  });

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
