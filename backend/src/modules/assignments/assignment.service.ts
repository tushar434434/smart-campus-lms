import { AppError } from '../../errors/app-error.js';

import type {
  Assignment,
  AssignmentRepository,
} from './assignment.repository.interface.js';

import type {
  CreateAssignmentInput,
  UpdateAssignmentInput,
} from './assignment.schema.js';

import type { CourseRepository } from '../courses/course.repository.interface.js';
import type { EnrollmentRepository } from '../enrollments/enrollment.repository.interface.js';
import type { StudentRepository } from '../students/student.repository.interface.js';

import {
  InMemorySubmissionFileStorage,
  type SubmissionFileStorage,
} from '../submissions/submission-file-storage.js';

import { validateSubmissionFile } from '../submissions/submission-file-validation.js';

type AssignmentUser = {
  sub: string;
  role: 'student' | 'faculty' | 'admin';
};

type AssignmentManager = {
  sub: string;
  role: 'faculty' | 'admin';
};

export function createAssignmentService(
  repository: AssignmentRepository,
  courseRepository: CourseRepository,
  enrollmentRepository: EnrollmentRepository,
  studentRepository: StudentRepository,
  fileStorage: SubmissionFileStorage = new InMemorySubmissionFileStorage(),
) {
  async function requireCourseManager(
    courseId: string,
    user: AssignmentUser,
  ): Promise<void> {
    const course = await courseRepository.findById(courseId);

    if (!course) {
      throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
    }

    if (
      user.role !== 'admin' &&
      (user.role !== 'faculty' || course.ownerFacultyId !== user.sub)
    ) {
      throw new AppError(
        'You can only manage assignments for courses assigned to you',
        403,
        'FORBIDDEN',
      );
    }
  }

  async function requireApprovedStudentEnrollment(
    courseId: string,
    user: AssignmentUser,
  ): Promise<void> {
    if (user.role !== 'student') return;

    const course = await courseRepository.findById(courseId);

    if (!course || course.approvalStatus !== 'approved') {
      throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
    }

    const student = await studentRepository.findByUserId(user.sub);

    if (!student) {
      throw new AppError(
        'Student account is not linked',
        403,
        'STUDENT_NOT_LINKED',
      );
    }

    const enrollment = await enrollmentRepository.findByStudentAndCourse(
      student.id,
      courseId,
    );

    if (!enrollment || enrollment.status !== 'approved') {
      throw new AppError(
        'Approved enrollment is required',
        403,
        'NOT_ENROLLED',
      );
    }
  }

  // Best-effort cleanup: never remove a newly attached file
  // just because deleting an older file failed.
  async function removeFileSafely(key: string): Promise<void> {
    try {
      await fileStorage.remove(key);
    } catch {
      // The database operation has already succeeded.
      // A stale file may need manual or scheduled cleanup.
    }
  }

  return {
    async createAssignment(
      input: CreateAssignmentInput,
      user: AssignmentManager,
    ): Promise<Assignment> {
      const course = await courseRepository.findById(input.courseId);

      if (!course) {
        throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
      }

      await requireCourseManager(input.courseId, user);

      return repository.create(input);
    },

    async uploadAssignmentFile(
      id: string,
      buffer: Buffer,
      mimeType: string,
      originalFileName: string,
      user: AssignmentManager,
    ): Promise<Assignment> {
      const assignment = await repository.findById(id);

      if (!assignment) {
        throw new AppError('Assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
      }

      await requireCourseManager(assignment.courseId, user);

      const validatedMimeType = validateSubmissionFile(buffer, mimeType);
      const previousFile = await repository.findStoredFile(id);

      const key = await fileStorage.save(buffer, validatedMimeType);

      let updated: Assignment | undefined;

      try {
        updated = await repository.attachFile(id, {
          key,
          mimeType: validatedMimeType,
          size: buffer.byteLength,
          originalFileName: originalFileName.slice(0, 255),
        });

        if (!updated) {
          throw new AppError(
            'Assignment not found',
            404,
            'ASSIGNMENT_NOT_FOUND',
          );
        }
      } catch (error) {
        await removeFileSafely(key);
        throw error;
      }

      // Database now points to the new file.
      // Failure to remove the old file must not roll back the new one.
      if (previousFile && previousFile.key !== key) {
        await removeFileSafely(previousFile.key);
      }

      return updated;
    },

    async getAssignmentFile(id: string, user: AssignmentUser) {
      const assignment = await repository.findById(id);

      if (!assignment) {
        throw new AppError('Assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
      }

      if (user.role === 'student') {
        await requireApprovedStudentEnrollment(assignment.courseId, user);
      } else {
        await requireCourseManager(assignment.courseId, user);
      }

      const file = await repository.findStoredFile(id);

      if (!file) {
        throw new AppError(
          'No file is attached to this assignment',
          404,
          'ASSIGNMENT_FILE_NOT_FOUND',
        );
      }

      return {
        buffer: await fileStorage.read(file.key),
        mimeType: file.mimeType,
        size: file.size,
        originalFileName: file.originalFileName,
      };
    },

    async getAssignmentById(
      id: string,
      user: AssignmentUser,
    ): Promise<Assignment> {
      const assignment = await repository.findById(id);

      if (!assignment) {
        throw new AppError('Assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
      }

      if (user.role === 'student') {
        await requireApprovedStudentEnrollment(assignment.courseId, user);
      } else {
        await requireCourseManager(assignment.courseId, user);
      }

      return assignment;
    },

    async getAssignmentsByCourse(
      courseId: string,
      user: AssignmentUser,
    ): Promise<Assignment[]> {
      const course = await courseRepository.findById(courseId);

      if (!course) {
        throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
      }

      if (user.role === 'student') {
        await requireApprovedStudentEnrollment(courseId, user);
      } else {
        await requireCourseManager(courseId, user);
      }

      return repository.findAllByCourseId(courseId);
    },

    async updateAssignment(
      id: string,
      input: UpdateAssignmentInput,
      user: AssignmentManager,
    ): Promise<Assignment> {
      const current = await repository.findById(id);

      if (!current) {
        throw new AppError('Assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
      }

      await requireCourseManager(current.courseId, user);

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
        throw new AppError('Assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
      }

      return assignment;
    },

    async deleteAssignment(id: string, user: AssignmentManager): Promise<void> {
      const current = await repository.findById(id);

      if (!current) {
        throw new AppError('Assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
      }

      await requireCourseManager(current.courseId, user);

      const file = await repository.findStoredFile(id);
      const deleted = await repository.delete(id);

      if (!deleted) {
        throw new AppError('Assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
      }

      if (file) {
        await removeFileSafely(file.key);
      }
    },
  };
}
