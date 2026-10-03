import type { CreateCourseInput } from './course.schema.js';

export interface Course extends CreateCourseInput {
  id: string;
  createdAt: string;
}

const courses: Course[] = [];

export function createCourse(input: CreateCourseInput): Course {
  const course: Course = {
    id: crypto.randomUUID(),
    ...input,
    createdAt: new Date().toISOString(),
  };

  courses.push(course);

  return course;
}

export function getCourses(): Course[] {
  return courses;
}
export function getCourseById(id: string): Course | undefined {
  return courses.find((course) => course.id === id);
}
