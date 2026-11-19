import type { Course, CourseApprovalStatus } from './course.repository.js';
import type {
  CreateCourseInput,
  UpdateCourseInput,
  ListCoursesInput,
} from './course.schema.js';

export interface CourseRepository {
  create(input: CreateCourseInput, ownerFacultyId?: string): Promise<Course>;

  findAll(
    input: ListCoursesInput,
    ownerFacultyId?: string,
    approvalStatus?: CourseApprovalStatus | 'all',
  ): Promise<{ courses: Course[]; total: number }>;

  findById(id: string): Promise<Course | undefined>;

  update(id: string, input: UpdateCourseInput): Promise<Course | undefined>;

  setOwnerFacultyId(
    id: string,
    ownerFacultyId: string | null,
  ): Promise<Course | undefined>;

  approvePending(id: string, reviewerId: string): Promise<Course | undefined>;

  rejectPending(
    id: string,
    reviewerId: string,
    reason: string,
  ): Promise<Course | undefined>;

  resubmitRejected(
    id: string,
    ownerFacultyId: string,
  ): Promise<Course | undefined>;

  delete(id: string): Promise<boolean>;
}
