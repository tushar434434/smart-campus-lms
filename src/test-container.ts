import {
  InMemoryAssignmentRepository,
} from './modules/assignments/assignment.repository.js';
import { createAssignmentService } from './modules/assignments/assignment.service.js';

import { InMemoryAuthRepository } from './modules/auth/auth.repository.js';
import { createAuthService } from './modules/auth/auth.service.js';

import { InMemoryCourseRepository } from './modules/courses/course.repository.js';
import { createCourseService } from './modules/courses/course.service.js';

import {
  InMemoryEnrollmentRepository,
} from './modules/enrollments/enrollment.repository.js';
import { createEnrollmentService } from './modules/enrollments/enrollment.service.js';

import {
  InMemoryStudentRepository,
} from './modules/students/student.repository.js';
import { createStudentService } from './modules/students/student.service.js';

import {
  InMemorySubmissionRepository,
} from './modules/submissions/submission.repository.js';
import { createSubmissionService } from './modules/submissions/submission.service.js';

export function createTestContainer() {
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

  return {
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