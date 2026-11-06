import { AppError } from '../../errors/app-error.js';
import type { AuthRepository } from '../auth/auth.repository.interface.js';
import type { CourseRepository } from '../courses/course.repository.interface.js';
import type { StudentRepository } from '../students/student.repository.interface.js';
import { resolveStudentForUser } from '../students/student.service.js';
import type { EnrollmentRepository } from './enrollment.repository.interface.js';

export function createEnrollmentService(
  repository: EnrollmentRepository,
  studentRepository: StudentRepository,
  courseRepository: CourseRepository,
  authRepository?: AuthRepository,
) {
  async function requireCourseReviewer(
    courseId: string,
    user: { sub: string; role: 'student' | 'faculty' | 'admin' },
  ) {
    const course = await courseRepository.findById(courseId);
    if (!course) {
      throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
    }
    if (user.role === 'admin') return course;
    if (user.role !== 'faculty' || course.ownerFacultyId !== user.sub) {
      throw new AppError(
        'You can only manage enrollments for courses assigned to you',
        403,
        'FORBIDDEN',
      );
    }
    return course;
  }

  return {
    async enrollStudent(
      studentId: string,
      courseId: string,
      user: { sub: string; role: 'faculty' | 'admin' },
    ) {
      const student = await studentRepository.findById(studentId);

      if (!student) {
        throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND');
      }

      const course = await courseRepository.findById(courseId);

      if (!course) {
        throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
      }
      if (course.approvalStatus !== 'approved') {
        throw new AppError(
          'Students can only be enrolled in approved courses',
          409,
          'COURSE_NOT_APPROVED',
        );
      }
      await requireCourseReviewer(courseId, user);

      const existing = await repository.findByStudentAndCourse(
        studentId,
        courseId,
      );

      if (existing) {
        throw new AppError(
          'Student is already enrolled in this course',
          409,
          'ENROLLMENT_EXISTS',
        );
      }

      return repository.create({ studentId, courseId, status: 'approved' });
    },

    async requestEnrollment(userId: string, courseId: string) {
      const student = await resolveStudentForUser(
        userId,
        studentRepository,
        authRepository,
      );
      if (!student) {
        throw new AppError(
          'Student account is not linked to a student record',
          403,
          'STUDENT_NOT_LINKED',
        );
      }
      const course = await courseRepository.findById(courseId);
      if (!course || course.approvalStatus !== 'approved') {
        throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
      }
      const existing = await repository.findByStudentAndCourse(
        student.id,
        courseId,
      );
      if (existing?.status === 'rejected') {
        const request = await repository.resetRejected(existing.id);
        if (request) return request;
      }
      if (existing) {
        throw new AppError(
          existing.status === 'approved'
            ? 'You are already enrolled in this course'
            : 'An enrollment request is already pending',
          409,
          'ENROLLMENT_EXISTS',
        );
      }
      return repository.create({
        studentId: student.id,
        courseId,
        status: 'pending',
      });
    },

    async getCurrentStudentEnrollments(userId: string) {
      const student = await resolveStudentForUser(
        userId,
        studentRepository,
        authRepository,
      );
      if (!student) {
        throw new AppError(
          'Student account is not linked to a student record',
          403,
          'STUDENT_NOT_LINKED',
        );
      }
      return repository.findByStudentId(student.id);
    },

    async listRequests(
      status: 'pending' | 'approved' | 'rejected',
      user: { sub: string; role: 'faculty' | 'admin' },
    ) {
      const requests = await repository.findAll(status);
      const visible = await Promise.all(
        requests.map(async (request) => {
          const course = await courseRepository.findById(request.courseId);
          if (!course) return undefined;
          if (user.role === 'faculty' && course.ownerFacultyId !== user.sub) {
            return undefined;
          }
          const student = await studentRepository.findById(request.studentId);
          if (!student) return undefined;
          return {
            ...request,
            course: { id: course.id, title: course.title, code: course.code },
            student: {
              id: student.id,
              name: student.name,
              email: student.email,
              enrollmentNumber: student.enrollmentNumber,
            },
          };
        }),
      );
      return visible.filter((item) => item !== undefined);
    },

    async reviewRequest(
      enrollmentId: string,
      decision: 'approved' | 'rejected',
      user: { sub: string; role: 'faculty' | 'admin' },
      rejectionReason?: string,
    ) {
      const existing = await repository.findById(enrollmentId);
      if (!existing) {
        throw new AppError(
          'Enrollment request not found',
          404,
          'ENROLLMENT_NOT_FOUND',
        );
      }
      if (existing.status !== 'pending') {
        throw new AppError(
          'Only pending enrollment requests can be reviewed',
          409,
          'ENROLLMENT_NOT_PENDING',
        );
      }
      await requireCourseReviewer(existing.courseId, user);
      const updated = await repository.updatePendingStatus(
        enrollmentId,
        decision,
        user.sub,
        rejectionReason,
      );
      if (!updated) {
        throw new AppError(
          'Enrollment request state changed; refresh and try again',
          409,
          'ENROLLMENT_NOT_PENDING',
        );
      }
      return updated;
    },

    async getStudentEnrollments(studentId: string) {
      const student = await studentRepository.findById(studentId);

      if (!student) {
        throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND');
      }

      return repository.findByStudentId(studentId);
    },

    async deleteEnrollment(id: string) {
      const deleted = await repository.delete(id);

      if (!deleted) {
        throw new AppError('Enrollment not found', 404, 'ENROLLMENT_NOT_FOUND');
      }
    },
  };
}
