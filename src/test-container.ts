import { InMemoryAssignmentRepository } from './modules/assignments/assignment.repository.js';
import { createAssignmentService } from './modules/assignments/assignment.service.js';

import { InMemoryAuthRepository } from './modules/auth/auth.repository.js';
import { createAuthService } from './modules/auth/auth.service.js';
import { InMemoryPasswordResetRepository } from './modules/auth/password-reset.repository.js';
import { createPasswordResetService } from './modules/auth/password-reset.service.js';
import { InMemoryAdminRepository } from './modules/admin/admin.repository.js';
import { createAdminService } from './modules/admin/admin.service.js';

import { InMemoryCourseRepository } from './modules/courses/course.repository.js';
import { createCourseService } from './modules/courses/course.service.js';
import { InMemoryCourseMaterialRepository } from './modules/courses/course-material.repository.js';
import { createCourseMaterialService } from './modules/courses/course-material.service.js';
import { InMemoryCourseMaterialFileStorage } from './modules/courses/course-material-file-storage.js';

import { InMemoryEnrollmentRepository } from './modules/enrollments/enrollment.repository.js';
import { createEnrollmentService } from './modules/enrollments/enrollment.service.js';

import { InMemoryQuizRepository } from './modules/quizzes/quiz.repository.js';
import { QuizService } from './modules/quizzes/quiz.service.js';

import { InMemoryQuizAttemptRepository } from './modules/quiz-attempts/quiz-attempt.in-memory.repository.js';
import { QuizAttemptService } from './modules/quiz-attempts/quiz-attempt.service.js';

import { InMemoryStudentRepository } from './modules/students/student.repository.js';
import { createStudentService } from './modules/students/student.service.js';

import { InMemorySubmissionRepository } from './modules/submissions/submission.repository.js';
import { createSubmissionService } from './modules/submissions/submission.service.js';
import { createReportService } from './modules/reports/report.service.js';

export function createTestContainer() {
  // Mock Prisma client for health-check tests.
  // This avoids requiring a real database in unit/integration tests.
  const prisma = {
    $queryRaw: async () => [{ '?column?': 1 }],
    $disconnect: async () => undefined,
  };

  // Repositories
  const courseRepository = new InMemoryCourseRepository();
  const courseMaterialRepository = new InMemoryCourseMaterialRepository();
  const courseMaterialFileStorage = new InMemoryCourseMaterialFileStorage();
  const studentRepository = new InMemoryStudentRepository();
  const enrollmentRepository = new InMemoryEnrollmentRepository();
  const assignmentRepository = new InMemoryAssignmentRepository();
  const submissionRepository = new InMemorySubmissionRepository();
  const authRepository = new InMemoryAuthRepository();
  const adminRepository = new InMemoryAdminRepository();
  const passwordResetRepository = new InMemoryPasswordResetRepository();
  const quizRepository = new InMemoryQuizRepository();
  const quizAttemptRepository = new InMemoryQuizAttemptRepository(
    quizRepository,
  );

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
  );

  const submissionService = createSubmissionService(
    submissionRepository,
    studentRepository,
    assignmentRepository,
    enrollmentRepository,
    courseRepository,
  );

  const authService = createAuthService(authRepository, {
    linkRegisteredStudent: (userId) =>
      studentService.tryLinkMatchingAccount(userId),
  });
  const adminService = createAdminService(adminRepository, authRepository);
  const passwordResetService = createPasswordResetService(
    passwordResetRepository,
    { sendPasswordResetOtp: async () => undefined },
    { secret: 'test-reset-secret', ttlMinutes: 10 },
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
