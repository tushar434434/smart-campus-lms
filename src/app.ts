import Fastify from 'fastify';

import { errorHandler } from './errors/error-handler.js';

import { courseRoutes } from './modules/courses/course.routes.js';
import { studentRoutes } from './modules/students/student.routes.js';
import { enrollmentRoutes } from './modules/enrollments/enrollment.routes.js';

import { InMemoryCourseRepository } from './modules/courses/course.repository.js';
import { InMemoryStudentRepository } from './modules/students/student.repository.js';
import { InMemoryEnrollmentRepository } from './modules/enrollments/enrollment.repository.js';

import { createCourseService } from './modules/courses/course.service.js';
import { createStudentService } from './modules/students/student.service.js';
import { createEnrollmentService } from './modules/enrollments/enrollment.service.js';

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.setErrorHandler(errorHandler);

  const courseRepository = new InMemoryCourseRepository();
  const studentRepository = new InMemoryStudentRepository();
  const enrollmentRepository = new InMemoryEnrollmentRepository();

  const courseService = createCourseService(courseRepository);
  const studentService = createStudentService(studentRepository);

  const enrollmentService = createEnrollmentService(
    enrollmentRepository,
    studentRepository,
    courseRepository,
  );

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

  app.register(courseRoutes, { service: courseService });
  app.register(studentRoutes, { service: studentService });
  app.register(enrollmentRoutes, { service: enrollmentService });

  return app;
}
