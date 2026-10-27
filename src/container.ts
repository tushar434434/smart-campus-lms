import 'dotenv/config';
import { config } from './config/env.js';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

import { PrismaAssignmentRepository } from './modules/assignments/assignment.prisma.repository.js';
import { createAssignmentService } from './modules/assignments/assignment.service.js';

import { PrismaAuthRepository } from './modules/auth/auth.prisma.repository.js';
import { createAuthService } from './modules/auth/auth.service.js';
import { SmtpEmailService } from './modules/auth/email.service.js';
import { PrismaPasswordResetRepository } from './modules/auth/password-reset.prisma.repository.js';
import { createPasswordResetService } from './modules/auth/password-reset.service.js';
import { PrismaAdminRepository } from './modules/admin/admin.prisma.repository.js';
import { createAdminService } from './modules/admin/admin.service.js';

import { createCourseService } from './modules/courses/course.service.js';
import { PrismaCourseRepository } from './modules/courses/course.prisma.repository.js';

import { PrismaEnrollmentRepository } from './modules/enrollments/enrollment.prisma.repository.js';
import { createEnrollmentService } from './modules/enrollments/enrollment.service.js';

import { PrismaQuizRepository } from './modules/quizzes/quiz.prisma.repository.js';
import { QuizService } from './modules/quizzes/quiz.service.js';

import { PrismaQuizAttemptRepository } from './modules/quiz-attempts/quiz-attempt.prisma.repository.js';
import { QuizAttemptService } from './modules/quiz-attempts/quiz-attempt.service.js';

import { PrismaStudentRepository } from './modules/students/student.prisma.repository.js';
import { createStudentService } from './modules/students/student.service.js';

import { PrismaSubmissionRepository } from './modules/submissions/submission.prisma.repository.js';
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
  const enrollmentRepository = new PrismaEnrollmentRepository(prisma);
  const submissionRepository = new PrismaSubmissionRepository(prisma);
  const authRepository = new PrismaAuthRepository(prisma);
  const adminRepository = new PrismaAdminRepository(prisma);
  const passwordResetRepository = new PrismaPasswordResetRepository(prisma);
  const quizRepository = new PrismaQuizRepository(prisma);

  const quizAttemptRepository = new PrismaQuizAttemptRepository(prisma);

  // Services
  const courseService = createCourseService(courseRepository);

  const studentService = createStudentService(
    studentRepository,
    authRepository,
  );

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
  const adminService = createAdminService(adminRepository);
  const passwordResetService = createPasswordResetService(
    passwordResetRepository,
    new SmtpEmailService(config.smtp),
    {
      secret:
        config.passwordResetSecret ??
        config.jwtSecret ??
        'test-only-password-reset-secret',
      ttlMinutes: config.passwordResetOtpTtlMinutes,
      logger: { warn: (message) => console.warn(message) },
    },
  );

  const quizService = new QuizService(quizRepository, courseRepository);

  const quizAttemptService = new QuizAttemptService(
    quizAttemptRepository,
    quizRepository,
    enrollmentRepository,
  );

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
    adminRepository,
    adminService,
    passwordResetRepository,
    passwordResetService,

    quizRepository,
    quizService,

    quizAttemptRepository,
    quizAttemptService,
  };
}
