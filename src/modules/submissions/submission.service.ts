import { AppError } from '../../errors/app-error.js';

import type { AssignmentRepository } from '../assignments/assignment.repository.interface.js';
import type { UserRole } from '../auth/auth.schema.js';
import type { StudentRepository } from '../students/student.repository.interface.js';

import type { SubmissionRepository } from './submission.repository.interface.js';

import type {
  CreateSubmissionInput,
  GradeSubmissionInput,
  UpdateSubmissionInput,
} from './submission.schema.js';

type AuthenticatedUser = {
  sub: string;
  role: UserRole;
};

export function createSubmissionService(
  repository: SubmissionRepository,
  studentRepository: StudentRepository,
  assignmentRepository: AssignmentRepository,
) {
  async function getOwnedStudentId(user: AuthenticatedUser): Promise<string> {
    const student = await studentRepository.findByUserId(user.sub);

    if (!student) {
      throw new AppError(
        'Student account is not linked to a student record',
        403,
        'FORBIDDEN',
      );
    }

    return student.id;
  }

  return {
    async createSubmission(
      input: CreateSubmissionInput,
      user: AuthenticatedUser,
    ) {
      if (user.role === 'student') {
        const ownedStudentId = await getOwnedStudentId(user);

        if (ownedStudentId !== input.studentId) {
          throw new AppError(
            'Students can only submit work for themselves',
            403,
            'FORBIDDEN',
          );
        }
      }

      const student = await studentRepository.findById(input.studentId);

      if (!student) {
        throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND');
      }

      const assignment = await assignmentRepository.findById(
        input.assignmentId,
      );

      if (!assignment) {
        throw new AppError('Assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
      }

      if (new Date() > new Date(assignment.dueAt)) {
        throw new AppError(
          'The assignment deadline has passed',
          409,
          'ASSIGNMENT_DEADLINE_PASSED',
        );
      }

      const existing = await repository.findByStudentAndAssignment(
        input.studentId,
        input.assignmentId,
      );

      if (existing) {
        throw new AppError(
          'Student has already submitted this assignment',
          409,
          'SUBMISSION_EXISTS',
        );
      }

      return repository.create(input);
    },

    async getSubmissionById(id: string, user: AuthenticatedUser) {
      const submission = await repository.findById(id);

      if (!submission) {
        throw new AppError('Submission not found', 404, 'SUBMISSION_NOT_FOUND');
      }

      if (user.role === 'student') {
        const ownedStudentId = await getOwnedStudentId(user);

        if (submission.studentId !== ownedStudentId) {
          throw new AppError(
            'You do not have permission to view this submission',
            403,
            'FORBIDDEN',
          );
        }
      }

      return submission;
    },

    async getStudentSubmissions(studentId: string, user: AuthenticatedUser) {
      if (user.role === 'student') {
        const ownedStudentId = await getOwnedStudentId(user);

        if (ownedStudentId !== studentId) {
          throw new AppError(
            'You do not have permission to view these submissions',
            403,
            'FORBIDDEN',
          );
        }
      }

      const student = await studentRepository.findById(studentId);

      if (!student) {
        throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND');
      }

      return repository.findByStudentId(studentId);
    },

    async getAssignmentSubmissions(
      assignmentId: string,
      user: AuthenticatedUser,
    ) {
      if (user.role === 'student') {
        throw new AppError(
          'You do not have permission to view these submissions',
          403,
          'FORBIDDEN',
        );
      }

      const assignment = await assignmentRepository.findById(assignmentId);

      if (!assignment) {
        throw new AppError('Assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
      }

      return repository.findByAssignmentId(assignmentId);
    },

    async updateSubmission(
      id: string,
      input: UpdateSubmissionInput,
      user: AuthenticatedUser,
    ) {
      const submission = await repository.findById(id);

      if (!submission) {
        throw new AppError('Submission not found', 404, 'SUBMISSION_NOT_FOUND');
      }

      if (user.role === 'student') {
        const ownedStudentId = await getOwnedStudentId(user);

        if (submission.studentId !== ownedStudentId) {
          throw new AppError(
            'You can only update your own submission',
            403,
            'FORBIDDEN',
          );
        }
      }

      if (submission.status === 'graded') {
        throw new AppError(
          'Graded submissions cannot be edited',
          409,
          'SUBMISSION_ALREADY_GRADED',
        );
      }

      const updatedSubmission = await repository.updateContent(
        id,
        input.content,
      );

      if (!updatedSubmission) {
        throw new AppError('Submission not found', 404, 'SUBMISSION_NOT_FOUND');
      }

      return updatedSubmission;
    },

    async gradeSubmission(
      id: string,
      input: GradeSubmissionInput,
      user: AuthenticatedUser,
    ) {
      if (user.role === 'student') {
        throw new AppError(
          'You do not have permission to grade submissions',
          403,
          'FORBIDDEN',
        );
      }

      const submission = await repository.findById(id);

      if (!submission) {
        throw new AppError('Submission not found', 404, 'SUBMISSION_NOT_FOUND');
      }

      if (submission.status === 'graded') {
        throw new AppError(
          'Submission has already been graded',
          409,
          'SUBMISSION_ALREADY_GRADED',
        );
      }

      const assignment = await assignmentRepository.findById(
        submission.assignmentId,
      );

      if (!assignment) {
        throw new AppError('Assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
      }

      if (input.marks > assignment.maxMarks) {
        throw new AppError(
          `Marks cannot exceed ${assignment.maxMarks}`,
          400,
          'INVALID_MARKS',
        );
      }

      return repository.grade(id, input.marks, input.feedback);
    },
  };
}
