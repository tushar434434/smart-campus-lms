import { AppError } from '../../errors/app-error.js';

import type { AssignmentRepository } from '../assignments/assignment.repository.interface.js';
import type { UserRole } from '../auth/auth.schema.js';
import type { CourseRepository } from '../courses/course.repository.interface.js';
import type { EnrollmentRepository } from '../enrollments/enrollment.repository.interface.js';
import type { StudentRepository } from '../students/student.repository.interface.js';

import type {
  Submission,
  SubmissionRepository,
} from './submission.repository.interface.js';
import type { SubmissionFileStorage } from './submission-file-storage.js';
import { InMemorySubmissionFileStorage } from './submission-file-storage.js';
import { validateSubmissionFile } from './submission-file-validation.js';

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
  enrollmentRepository: EnrollmentRepository,
  courseRepository: CourseRepository,
  fileStorage: SubmissionFileStorage = new InMemorySubmissionFileStorage(),
) {
  async function requireCourseManager(
    courseId: string,
    user: AuthenticatedUser,
  ) {
    const course = await courseRepository.findById(courseId);
    if (!course) {
      throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
    }
    if (
      user.role !== 'admin' &&
      (user.role !== 'faculty' || course.ownerFacultyId !== user.sub)
    ) {
      throw new AppError(
        'You can only manage submissions for courses assigned to you',
        403,
        'FORBIDDEN',
      );
    }
  }

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
    async createSubmissionWithOptionalFile(
      input: { assignmentId: string; content?: string },
      file: { buffer: Buffer; mimeType: string } | undefined,
      user: AuthenticatedUser,
    ) {
      if (user.role !== 'student') {
        throw new AppError('Only students can submit work', 403, 'FORBIDDEN');
      }
      const studentId = await getOwnedStudentId(user);
      const assignment = await assignmentRepository.findById(
        input.assignmentId,
      );
      if (!assignment) {
        throw new AppError('Assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
      }
      await requireApprovedStudentEnrollment(
        studentId,
        input.assignmentId,
        user,
      );
      if (new Date() > new Date(assignment.dueAt)) {
        throw new AppError(
          'The assignment deadline has passed',
          409,
          'ASSIGNMENT_DEADLINE_PASSED',
        );
      }
      const content = input.content?.trim() ?? '';
      if (!file && content.length < 10) {
        throw new AppError(
          'Provide at least 10 characters of text or attach a valid file',
          400,
          'SUBMISSION_CONTENT_REQUIRED',
        );
      }
      const existing = await repository.findByStudentAndAssignment(
        studentId,
        input.assignmentId,
      );
      if (existing) {
        throw new AppError(
          'Student has already submitted this assignment',
          409,
          'SUBMISSION_EXISTS',
        );
      }

      const validatedMimeType = file
        ? validateSubmissionFile(file.buffer, file.mimeType)
        : undefined;
      const fileKey =
        file && validatedMimeType
          ? await fileStorage.save(file.buffer, validatedMimeType)
          : undefined;
      let submission: Submission | undefined;
      try {
        submission = await repository.create({
          studentId,
          assignmentId: input.assignmentId,
          content,
        });
        if (file && validatedMimeType && fileKey) {
          const attached = await repository.attachFile(submission.id, {
            key: fileKey,
            mimeType: validatedMimeType,
            size: file.buffer.byteLength,
          });
          if (!attached) {
            throw new AppError(
              'Submission could not be saved',
              500,
              'SUBMISSION_SAVE_FAILED',
            );
          }
          submission = attached;
        }
        return submission;
      } catch (error) {
        if (fileKey) await fileStorage.remove(fileKey);
        if (submission) await repository.delete(submission.id);
        throw error;
      }
    },

    async uploadSubmissionFile(
      id: string,
      buffer: Buffer,
      mimeType: string,
      user: AuthenticatedUser,
    ) {
      if (user.role !== 'student') {
        throw new AppError(
          'Only students can upload submission files',
          403,
          'FORBIDDEN',
        );
      }
      const submission = await getSubmissionByIdForUser(id, user);
      if (submission.status === 'graded') {
        throw new AppError(
          'Graded submissions cannot be changed',
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
      if (new Date() > new Date(assignment.dueAt)) {
        throw new AppError(
          'The assignment deadline has passed',
          409,
          'ASSIGNMENT_DEADLINE_PASSED',
        );
      }
      const validatedMimeType = validateSubmissionFile(buffer, mimeType);
      const previousFile = await repository.findStoredFile(id);
      const key = await fileStorage.save(buffer, validatedMimeType);
      let updated: Awaited<ReturnType<SubmissionRepository['attachFile']>>;
      try {
        updated = await repository.attachFile(id, {
          key,
          mimeType: validatedMimeType,
          size: buffer.byteLength,
        });
        if (!updated) {
          throw new AppError(
            'Submission not found',
            404,
            'SUBMISSION_NOT_FOUND',
          );
        }
      } catch (error) {
        await fileStorage.remove(key);
        throw error;
      }
      if (previousFile) await fileStorage.remove(previousFile.key);
      return updated;
    },

    async getSubmissionFile(id: string, user: AuthenticatedUser) {
      await getSubmissionByIdForUser(id, user);
      const file = await repository.findStoredFile(id);
      if (!file) {
        throw new AppError(
          'No file is attached to this submission',
          404,
          'SUBMISSION_FILE_NOT_FOUND',
        );
      }
      return {
        buffer: await fileStorage.read(file.key),
        mimeType: file.mimeType,
        size: file.size,
      };
    },

    async getCurrentStudentActivity(user: AuthenticatedUser) {
      if (user.role !== 'student') {
        throw new AppError('Student access is required', 403, 'FORBIDDEN');
      }

      const studentId = await getOwnedStudentId(user);
      const submissions = await repository.findByStudentId(studentId);

      return Promise.all(
        submissions.map(async (submission) => {
          const assignment = await assignmentRepository.findById(
            submission.assignmentId,
          );
          if (!assignment) {
            throw new AppError(
              'Assignment associated with a submission could not be found',
              500,
              'SUBMISSION_ASSIGNMENT_NOT_FOUND',
            );
          }
          const course = await courseRepository.findById(assignment.courseId);
          if (!course) {
            throw new AppError(
              'Course associated with an assignment could not be found',
              500,
              'ASSIGNMENT_COURSE_NOT_FOUND',
            );
          }

          return {
            ...submission,
            assignmentTitle: assignment.title,
            courseTitle: course.title,
            dueAt: assignment.dueAt,
            maxMarks: assignment.maxMarks,
          };
        }),
      );
    },

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

      if (user.role === 'student') {
        const enrollment = await enrollmentRepository.findByStudentAndCourse(
          input.studentId,
          assignment.courseId,
        );
        const course = await courseRepository.findById(assignment.courseId);
        if (!enrollment || enrollment.status !== 'approved') {
          throw new AppError(
            'Students must have approved enrollment to submit work',
            403,
            'NOT_ENROLLED',
          );
        }
        if (course?.approvalStatus !== 'approved') {
          throw new AppError(
            'Course is not available',
            404,
            'COURSE_NOT_FOUND',
          );
        }
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
        await requireApprovedStudentEnrollment(
          submission.studentId,
          submission.assignmentId,
          user,
        );
      } else {
        await requireCourseManager(
          (await assignmentRepository.findById(submission.assignmentId))
            ?.courseId ?? '',
          user,
        );
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

      await requireCourseManager(assignment.courseId, user);
      return repository.findByAssignmentId(assignmentId);
    },

    async getAssignmentRoster(assignmentId: string, user: AuthenticatedUser) {
      if (user.role === 'student') {
        throw new AppError(
          'You do not have permission to view this assignment roster',
          403,
          'FORBIDDEN',
        );
      }

      const assignment = await assignmentRepository.findById(assignmentId);
      if (!assignment) {
        throw new AppError('Assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
      }
      await requireCourseManager(assignment.courseId, user);

      const [enrollments, submissions] = await Promise.all([
        enrollmentRepository.findAllByCourseId(assignment.courseId),
        repository.findByAssignmentId(assignmentId),
      ]);
      const approvedEnrollments = enrollments.filter(
        (enrollment) => enrollment.status === 'approved',
      );
      const submissionsByStudent = new Map(
        submissions.map((submission) => [submission.studentId, submission]),
      );

      return Promise.all(
        approvedEnrollments.map(async (enrollment) => {
          const student = await studentRepository.findById(
            enrollment.studentId,
          );
          if (!student) {
            throw new AppError(
              'An enrolled student record could not be found',
              500,
              'ENROLLED_STUDENT_NOT_FOUND',
            );
          }
          const submission = submissionsByStudent.get(student.id);
          const isLate =
            submission !== undefined &&
            new Date(submission.submittedAt) > new Date(assignment.dueAt);

          return {
            student: {
              id: student.id,
              name: student.name,
              email: student.email,
              enrollmentNumber: student.enrollmentNumber,
            },
            submission: submission ?? null,
            status: !submission
              ? 'not_submitted'
              : submission.status === 'graded'
                ? 'graded'
                : isLate
                  ? 'late'
                  : 'submitted',
          };
        }),
      );
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
        await requireApprovedStudentEnrollment(
          submission.studentId,
          submission.assignmentId,
          user,
        );
      }

      if (submission.status === 'graded') {
        throw new AppError(
          'Graded submissions cannot be edited',
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
      if (new Date() > new Date(assignment.dueAt)) {
        throw new AppError(
          'The assignment deadline has passed',
          409,
          'ASSIGNMENT_DEADLINE_PASSED',
        );
      }

      const updatedSubmission = await repository.updateContent(
        id,
        input.content,
      );

      if (!updatedSubmission) {
        const current = await repository.findById(id);
        if (!current) {
          throw new AppError(
            'Submission not found',
            404,
            'SUBMISSION_NOT_FOUND',
          );
        }
        throw new AppError(
          'Graded submissions cannot be edited',
          409,
          'SUBMISSION_ALREADY_GRADED',
        );
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

      await requireCourseManager(assignment.courseId, user);

      if (input.marks > assignment.maxMarks) {
        throw new AppError(
          `Marks cannot exceed ${assignment.maxMarks}`,
          400,
          'INVALID_MARKS',
        );
      }

      const graded = await repository.grade(id, input.marks, input.feedback);
      if (!graded) {
        const current = await repository.findById(id);
        if (!current) {
          throw new AppError(
            'Submission not found',
            404,
            'SUBMISSION_NOT_FOUND',
          );
        }
        throw new AppError(
          'Submission has already been graded',
          409,
          'SUBMISSION_ALREADY_GRADED',
        );
      }
      return graded;
    },
  };

  async function getSubmissionByIdForUser(id: string, user: AuthenticatedUser) {
    const submission = await repository.findById(id);
    if (!submission) {
      throw new AppError('Submission not found', 404, 'SUBMISSION_NOT_FOUND');
    }

    if (user.role === 'student') {
      const studentId = await getOwnedStudentId(user);
      if (submission.studentId !== studentId) {
        throw new AppError(
          'You do not have permission to access this submission',
          403,
          'FORBIDDEN',
        );
      }
      await requireApprovedStudentEnrollment(
        studentId,
        submission.assignmentId,
        user,
      );
    } else {
      const assignment = await assignmentRepository.findById(
        submission.assignmentId,
      );
      if (!assignment) {
        throw new AppError('Assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
      }
      await requireCourseManager(assignment.courseId, user);
    }

    return submission;
  }

  async function requireApprovedStudentEnrollment(
    studentId: string,
    assignmentId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const assignment = await assignmentRepository.findById(assignmentId);
    if (!assignment) {
      throw new AppError('Assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
    }
    const course = await courseRepository.findById(assignment.courseId);
    if (!course || course.approvalStatus !== 'approved') {
      throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
    }
    const enrollment = await enrollmentRepository.findByStudentAndCourse(
      studentId,
      assignment.courseId,
    );
    if (!enrollment || enrollment.status !== 'approved') {
      throw new AppError(
        'Approved enrollment is required',
        403,
        'NOT_ENROLLED',
      );
    }
    if (user.role !== 'student') {
      throw new AppError('Student access is required', 403, 'FORBIDDEN');
    }
  }
}
