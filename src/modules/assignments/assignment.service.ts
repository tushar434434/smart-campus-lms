import { AppError } from '../../errors/app-error.js';
import type {
  Assignment,
  AssignmentRepository,
} from './assignment.repository.interface.js';
import type {
  CreateAssignmentInput,
  UpdateAssignmentInput,
} from './assignment.schema.js';

export function createAssignmentService(
  repository: AssignmentRepository,
  courseRepository: {
    findById(id: string): Promise<unknown>;
  },
) {
  return {
    async createAssignment(
      input: CreateAssignmentInput,
    ): Promise<Assignment> {
      const course = await courseRepository.findById(input.courseId);

      if (!course) {
        throw new AppError(
          'Course not found',
          404,
          'COURSE_NOT_FOUND',
        );
      }

      return repository.create(input);
    },

    async getAssignmentById(id: string): Promise<Assignment> {
      const assignment = await repository.findById(id);

      if (!assignment) {
        throw new AppError(
          'Assignment not found',
          404,
          'ASSIGNMENT_NOT_FOUND',
        );
      }

      return assignment;
    },

    async getAssignmentsByCourse(
      courseId: string,
    ): Promise<Assignment[]> {
      const course = await courseRepository.findById(courseId);

      if (!course) {
        throw new AppError(
          'Course not found',
          404,
          'COURSE_NOT_FOUND',
        );
      }

      return repository.findAllByCourseId(courseId);
    },

    async updateAssignment(
      id: string,
      input: UpdateAssignmentInput,
    ): Promise<Assignment> {
      const assignment = await repository.update(id, {
        ...(input.title !== undefined && {
          title: input.title,
        }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
        ...(input.dueAt !== undefined && {
          dueAt: input.dueAt,
        }),
        ...(input.maxMarks !== undefined && {
          maxMarks: input.maxMarks,
        }),
      });

      if (!assignment) {
        throw new AppError(
          'Assignment not found',
          404,
          'ASSIGNMENT_NOT_FOUND',
        );
      }

      return assignment;
    },

    async deleteAssignment(id: string): Promise<void> {
      const deleted = await repository.delete(id);

      if (!deleted) {
        throw new AppError(
          'Assignment not found',
          404,
          'ASSIGNMENT_NOT_FOUND',
        );
      }
    },
  };
}