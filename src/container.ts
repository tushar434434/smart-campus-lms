import 'dotenv/config';
import { resolve } from 'node:path';
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
import { PrismaCourseMaterialRepository } from './modules/courses/course-material.prisma.repository.js';
import { createCourseMaterialService } from './modules/courses/course-material.service.js';
import { LocalCourseMaterialFileStorage } from './modules/courses/course-material-file-storage.js';

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
import { LocalSubmissionFileStorage } from './modules/submissions/submission-file-storage.js';

import { createReportService } from './modules/reports/report.service.js';

export function createContainer() {
  const adapter = new PrismaPg({
    connectionString: config.databaseUrl,
  });

  const prisma = new PrismaClient({
    adapter,
  });

  // Repositories
  const courseRepository = new PrismaCourseRepository(prisma);
  const courseMaterialRepository = new PrismaCourseMaterialRepository(prisma);

  const studentRepository = new PrismaStudentRepository(
    prisma,
    config.studentEnrollmentPrefix,
  );

  const assignmentRepository = new PrismaAssignmentRepository(prisma);
  const enrollmentRepository = new PrismaEnrollmentRepository(prisma);
  const submissionRepository = new PrismaSubmissionRepository(prisma);

  // Persistent file storage.
  // Each module has its own directory under the configured upload root.
  const submissionFileStorage = new LocalSubmissionFileStorage(
    resolve(config.submissionUploadDirectory, 'submissions'),
  );

  const assignmentFileStorage = new LocalSubmissionFileStorage(
    resolve(config.submissionUploadDirectory, 'assignments'),
  );

  const courseMaterialFileStorage = new LocalCourseMaterialFileStorage(
    resolve(config.submissionUploadDirectory, 'course-materials'),
  );

  const authRepository = new PrismaAuthRepository(prisma);
  const adminRepository = new PrismaAdminRepository(prisma);
  const passwordResetRepository = new PrismaPasswordResetRepository(prisma);
  const quizRepository = new PrismaQuizRepository(prisma);
  const quizAttemptRepository = new PrismaQuizAttemptRepository(prisma);

  // Services
  const courseService = createCourseService(courseRepository, authRepository);

  const courseMaterialService = createCourseMaterialService(
    courseMaterialRepository,
    courseMaterialFileStorage,
    courseRepository,
    enrollmentRepository,
    studentRepository,
  );

  const studentService = createStudentService(
    studentRepository,
    authRepository,
  );

  const enrollmentService = createEnrollmentService(
    enrollmentRepository,
    studentRepository,
    courseRepository,
    authRepository,
  );

  const assignmentService = createAssignmentService(
    assignmentRepository,
    courseRepository,
    enrollmentRepository,
    studentRepository,
    assignmentFileStorage,
  );

  const submissionService = createSubmissionService(
    submissionRepository,
    studentRepository,
    assignmentRepository,
    enrollmentRepository,
    courseRepository,
    submissionFileStorage,
  );

  const authService = createAuthService(authRepository, {
    linkRegisteredStudent: (userId) =>
      studentService.tryLinkMatchingAccount(userId),
  });
  const adminService = createAdminService(adminRepository, authRepository);

  const passwordResetService = createPasswordResetService(
    passwordResetRepository,
    new SmtpEmailService(config.smtp),
    {
      secret:
        config.passwordResetSecret ??
        config.jwtSecret ??
        'test-only-password-reset-secret',
      ttlMinutes: config.passwordResetOtpTtlMinutes,
      logger: {
        warn: (message) => console.warn(message),
      },
    },
  );

  const quizService = new QuizService(
    quizRepository,
    courseRepository,
    enrollmentRepository,
    studentRepository,
    authRepository,
  );

  const quizAttemptService = new QuizAttemptService(
    quizAttemptRepository,
    quizRepository,
    enrollmentRepository,
    courseRepository,
    studentRepository,
  );

  const reportService = createReportService(
    assignmentRepository,
    quizService,
    quizAttemptService,
    submissionService,
    courseRepository,
  );

  return {
    prisma,

    courseRepository,
    courseService,
    courseMaterialRepository,
    courseMaterialService,

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

    reportService,
  };
}
