import 'dotenv/config';

import { PrismaAssignmentRepository } from './modules/assignments/assignment.prisma.repository.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

import { createAssignmentService } from './modules/assignments/assignment.service.js';

import { InMemoryAuthRepository } from './modules/auth/auth.repository.js';
import { createAuthService } from './modules/auth/auth.service.js';

import { createCourseService } from './modules/courses/course.service.js';
import { PrismaCourseRepository } from './modules/courses/course.prisma.repository.js';

import {
  InMemoryEnrollmentRepository,
} from './modules/enrollments/enrollment.repository.js';
import { createEnrollmentService } from './modules/enrollments/enrollment.service.js';

import { PrismaStudentRepository } from './modules/students/student.prisma.repository.js';
import { createStudentService } from './modules/students/student.service.js';

import {
  InMemorySubmissionRepository,
} from './modules/submissions/submission.repository.js';
import { createSubmissionService } from './modules/submissions/submission.service.js';

export function createContainer() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured');
  }

  const adapter = new PrismaPg({
    connectionString: databaseUrl,
  });

  const prisma = new PrismaClient({
    adapter,
  });

  // Repositories
  const courseRepository = new PrismaCourseRepository(prisma);
  const studentRepository = new PrismaStudentRepository(prisma);
  const assignmentRepository = new PrismaAssignmentRepository(prisma);

  const enrollmentRepository = new InMemoryEnrollmentRepository();
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

  return {
    prisma,

    courseRepository,
    courseService,

    studentRepository,
    studentService,

    enrollmentRepository,
    enrollmentService,

    assignmentRepository,
    assignmentService,

    submissionRepository,
    submissionService,

    authRepository,
    authService,
  };
}