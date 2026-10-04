import Fastify from 'fastify';

import { errorHandler } from './errors/error-handler.js';

import { courseRoutes } from './modules/courses/course.routes.js';
import { studentRoutes } from './modules/students/student.routes.js';
import { enrollmentRoutes } from './modules/enrollments/enrollment.routes.js';
import { assignmentRoutes } from './modules/assignments/assignment.routes.js';
import { submissionRoutes } from './modules/submissions/submission.routes.js';

import { InMemoryCourseRepository } from './modules/courses/course.repository.js';
import { InMemoryStudentRepository } from './modules/students/student.repository.js';
import { InMemoryEnrollmentRepository } from './modules/enrollments/enrollment.repository.js';
import { InMemoryAssignmentRepository } from './modules/assignments/assignment.repository.js';
import { InMemorySubmissionRepository } from './modules/submissions/submission.repository.js';

import { createCourseService } from './modules/courses/course.service.js';
import { createStudentService } from './modules/students/student.service.js';
import { createEnrollmentService } from './modules/enrollments/enrollment.service.js';
import { createAssignmentService } from './modules/assignments/assignment.service.js';
import { createSubmissionService } from './modules/submissions/submission.service.js';

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.setErrorHandler(errorHandler);

  // Repositories
  const courseRepository = new InMemoryCourseRepository();
  const studentRepository = new InMemoryStudentRepository();
  const enrollmentRepository = new InMemoryEnrollmentRepository();
  const assignmentRepository = new InMemoryAssignmentRepository();
  const submissionRepository = new InMemorySubmissionRepository();

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

  // Routes
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

  return app;
}
