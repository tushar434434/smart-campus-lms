import type { CreateCourseInput, UpdateCourseInput } from './course.schema.js';

import type { Course } from './course.repository.js';

export interface CourseRepository {
  create(input: CreateCourseInput): Course;
  findAll(): Course[];
  findById(id: string): Course | undefined;
  update(id: string, input: UpdateCourseInput): Course | undefined;
  delete(id: string): boolean;
}
