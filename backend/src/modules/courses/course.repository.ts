import type {
  CreateCourseInput,
  UpdateCourseInput,
  ListCoursesInput,
} from './course.schema.js';

import type { CourseRepository } from './course.repository.interface.js';

export interface Course extends CreateCourseInput {
  id: string;
  ownerFacultyId: string | null;
  approvalStatus: CourseApprovalStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
  reviewedById: string | null;
  createdAt: string;
}

export type CourseApprovalStatus = 'pending' | 'approved' | 'rejected';

export class InMemoryCourseRepository implements CourseRepository {
  private courses: Course[] = [];

  async create(
    input: CreateCourseInput,
    ownerFacultyId?: string,
  ): Promise<Course> {
    const existingCourse = this.courses.find(
      (course) => course.code === input.code,
    );

    if (existingCourse) {
      const error = new Error('Course code already exists') as Error & {
        code: string;
      };

      error.code = 'COURSE_CODE_EXISTS';
      throw error;
    }

    const course: Course = {
      id: crypto.randomUUID(),
      ownerFacultyId: ownerFacultyId ?? null,
      approvalStatus: 'pending',
      rejectionReason: null,
      reviewedAt: null,
      reviewedById: null,
      ...input,
      createdAt: new Date().toISOString(),
    };

    this.courses.push(course);

    return course;
  }

  async findAll(
    input: ListCoursesInput,
    ownerFacultyId?: string,
    approvalStatus?: CourseApprovalStatus | 'all',
  ): Promise<{ courses: Course[]; total: number }> {
    const { page, limit, search, credits } = input;

    let filteredCourses = this.courses.filter(
      (course) =>
        (ownerFacultyId === undefined ||
          course.ownerFacultyId === ownerFacultyId) &&
        (approvalStatus === undefined ||
          approvalStatus === 'all' ||
          course.approvalStatus === approvalStatus),
    );

    if (search) {
      const searchTerm = search.toLowerCase();

      filteredCourses = filteredCourses.filter(
        (course) =>
          course.title.toLowerCase().includes(searchTerm) ||
          course.code.toLowerCase().includes(searchTerm),
      );
    }

    if (credits !== undefined) {
      filteredCourses = filteredCourses.filter(
        (course) => course.credits === credits,
      );
    }

    const total = filteredCourses.length;
    const startIndex = (page - 1) * limit;

    const courses = filteredCourses.slice(startIndex, startIndex + limit);

    return {
      courses,
      total,
    };
  }

  async findById(id: string): Promise<Course | undefined> {
    return this.courses.find((course) => course.id === id);
  }

  async update(
    id: string,
    input: UpdateCourseInput,
  ): Promise<Course | undefined> {
    const course = this.courses.find((course) => course.id === id);

    if (!course) {
      return undefined;
    }

    if (
      input.code !== undefined &&
      this.courses.some(
        (existingCourse) =>
          existingCourse.id !== id && existingCourse.code === input.code,
      )
    ) {
      const error = new Error('Course code already exists') as Error & {
        code: string;
      };

      error.code = 'COURSE_CODE_EXISTS';
      throw error;
    }

    Object.assign(course, input);

    return course;
  }

  async setOwnerFacultyId(
    id: string,
    ownerFacultyId: string | null,
  ): Promise<Course | undefined> {
    const course = this.courses.find((item) => item.id === id);
    if (!course) return undefined;
    course.ownerFacultyId = ownerFacultyId;
    return course;
  }

  async approvePending(
    id: string,
    reviewerId: string,
  ): Promise<Course | undefined> {
    const course = this.courses.find(
      (item) => item.id === id && item.approvalStatus === 'pending',
    );
    if (!course) return undefined;
    course.approvalStatus = 'approved';
    course.rejectionReason = null;
    course.reviewedAt = new Date().toISOString();
    course.reviewedById = reviewerId;
    return course;
  }

  async rejectPending(
    id: string,
    reviewerId: string,
    reason: string,
  ): Promise<Course | undefined> {
    const course = this.courses.find(
      (item) => item.id === id && item.approvalStatus === 'pending',
    );
    if (!course) return undefined;
    course.approvalStatus = 'rejected';
    course.rejectionReason = reason;
    course.reviewedAt = new Date().toISOString();
    course.reviewedById = reviewerId;
    return course;
  }

  async resubmitRejected(
    id: string,
    ownerFacultyId: string,
  ): Promise<Course | undefined> {
    const course = this.courses.find(
      (item) =>
        item.id === id &&
        item.ownerFacultyId === ownerFacultyId &&
        item.approvalStatus === 'rejected',
    );
    if (!course) return undefined;
    course.approvalStatus = 'pending';
    course.rejectionReason = null;
    course.reviewedAt = null;
    course.reviewedById = null;
    return course;
  }

  async delete(id: string): Promise<boolean> {
    const courseIndex = this.courses.findIndex((course) => course.id === id);

    if (courseIndex === -1) {
      return false;
    }

    this.courses.splice(courseIndex, 1);

    return true;
  }
}
