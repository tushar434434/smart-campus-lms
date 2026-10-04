import type { Course } from './course.repository.js';
import type {
  CreateCourseInput,
  UpdateCourseInput,
  ListCoursesInput,
} from './course.schema.js';
export interface CourseRepository {
  create(input: CreateCourseInput): Course;
  findAll(input: ListCoursesInput): {
    courses: Course[];
    total: number;
  };
  findById(id: string): Course | undefined;
  update(id: string, input: UpdateCourseInput): Course | undefined;
  delete(id: string): boolean;
}
