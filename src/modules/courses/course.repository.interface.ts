import type { Course } from './course.repository.js';
import type {
  CreateCourseInput,
  UpdateCourseInput,
  ListCoursesInput,
} from './course.schema.js';

export interface CourseRepository {
  create(input: CreateCourseInput): Promise<Course>;

  findAll(input: ListCoursesInput): Promise<{
    courses: Course[];
    total: number;
  }>;

  findById(id: string): Promise<Course | undefined>;

  update(id: string, input: UpdateCourseInput): Promise<Course | undefined>;

  delete(id: string): Promise<boolean>;
}
