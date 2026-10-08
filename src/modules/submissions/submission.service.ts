import { AppError } from '../../errors/app-error.js';

import type { StudentRepository } from '../students/student.repository.interface.js';
import type { AssignmentRepository } from '../assignments/assignment.repository.interface.js';

import type { SubmissionRepository } from './submission.repository.interface.js';

import type {
  CreateSubmissionInput,
  GradeSubmissionInput,
  UpdateSubmissionInput,
} from './submission.schema.js';

export function createSubmissionService(
  repository: SubmissionRepository,
  studentRepository: StudentRepository,
  assignmentRepository: AssignmentRepository,
) {
  return {
    async createSubmission(input: CreateSubmissionInput) {
      const student = await studentRepository.findById(input.studentId);

      if (!student) {
        throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND');
      }

      const assignment = await assignmentRepository.findById(
        input.assignmentId,
      );

      if (!assignment) {
        throw new AppError(
          'Assignment not found',
          404,
          'ASSIGNMENT_NOT_FOUND',
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

    async getSubmissionById(id: string) {
      const submission = await repository.findById(id);

      if (!submission) {
        throw new AppError(
          'Submission not found',
          404,
          'SUBMISSION_NOT_FOUND',
        );
      }

      return submission;
    },

    async getStudentSubmissions(studentId: string) {
      const student = await studentRepository.findById(studentId);

      if (!student) {
        throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND');
      }

      return repository.findByStudentId(studentId);
    },

    async getAssignmentSubmissions(assignmentId: string) {
      const assignment = await assignmentRepository.findById(assignmentId);

      if (!assignment) {
        throw new AppError(
          'Assignment not found',
          404,
          'ASSIGNMENT_NOT_FOUND',
        );
      }

      return repository.findByAssignmentId(assignmentId);
    },

    async updateSubmission(id: string, input: UpdateSubmissionInput) {
      const submission = await repository.updateContent(id, input.content);

      if (!submission) {
        throw new AppError(
          'Submission not found',
          404,
          'SUBMISSION_NOT_FOUND',
        );
      }

      return submission;
    },

    async gradeSubmission(id: string, input: GradeSubmissionInput) {
      const submission = await repository.findById(id);

      if (!submission) {
        throw new AppError(
          'Submission not found',
          404,
          'SUBMISSION_NOT_FOUND',
        );
      }

      const assignment = await assignmentRepository.findById(
        submission.assignmentId,
      );

      if (!assignment) {
        throw new AppError(
          'Assignment not found',
          404,
          'ASSIGNMENT_NOT_FOUND',
        );
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
