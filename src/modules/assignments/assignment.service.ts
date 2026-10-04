import { AppError } from '../../errors/app-error.js';

import type { CourseRepository } from '../courses/course.repository.interface.js';

import type {
  Assignment,
  AssignmentRepository,
} from './assignment.repository.interface.js';

import type {
  CreateAssignmentInput,
  UpdateAssignmentInput,
} from './assignment.schema.js';

type AssignmentUpdate = Partial<
  Pick<Assignment, 'title' | 'description' | 'dueAt' | 'maxMarks'>
>;

export function createAssignmentService(
  repository: AssignmentRepository,
  courseRepository: CourseRepository,
) {
  return {
    createAssignment(input: CreateAssignmentInput) {
      const course = courseRepository.findById(input.courseId);

      if (!course) {
        throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
      }

      return repository.create(input);
    },

    getCourseAssignments(courseId: string) {
      const course = courseRepository.findById(courseId);

      if (!course) {
        throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
      }

      return repository.findAllByCourseId(courseId);
    },

    getAssignmentById(id: string) {
      const assignment = repository.findById(id);

      if (!assignment) {
        throw new AppError('Assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
      }

      return assignment;
    },

    updateAssignment(id: string, input: UpdateAssignmentInput) {
      const updateData: AssignmentUpdate = {};

      if (input.title !== undefined) {
        updateData.title = input.title;
      }

      if (input.description !== undefined) {
        updateData.description = input.description;
      }

      if (input.dueAt !== undefined) {
        updateData.dueAt = input.dueAt;
      }

      if (input.maxMarks !== undefined) {
        updateData.maxMarks = input.maxMarks;
      }

      const assignment = repository.update(id, updateData);

      if (!assignment) {
        throw new AppError('Assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
      }

      return assignment;
    },

    deleteAssignment(id: string) {
      const deleted = repository.delete(id);

      if (!deleted) {
        throw new AppError('Assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
      }
    },
  };
}
