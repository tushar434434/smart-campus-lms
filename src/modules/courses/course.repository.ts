import type { CreateCourseInput } from './course.schema.js';
import type { UpdateCourseInput } from './course.schema.js';

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
export function updateCourse(
  id: string,
  input: UpdateCourseInput,
): Course | undefined {
  const course = courses.find((course) => course.id === id);

  if (!course) {
    return undefined;
  }

  Object.assign(course, input);

  return course;
}
export function deleteCourse(id: string): boolean {
  const courseIndex = courses.findIndex((course) => course.id === id);

  if (courseIndex === -1) {
    return false;
  }

  courses.splice(courseIndex, 1);

  return true;
}