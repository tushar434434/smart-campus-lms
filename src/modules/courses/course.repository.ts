import type { CreateCourseInput, UpdateCourseInput } from './course.schema.js';

import type { CourseRepository } from './course.repository.interface.js';

export interface Course extends CreateCourseInput {
  id: string;
  createdAt: string;
}

export class InMemoryCourseRepository implements CourseRepository {
  private courses: Course[] = [];

  create(input: CreateCourseInput): Course {
    const course: Course = {
      id: crypto.randomUUID(),
      ...input,
      createdAt: new Date().toISOString(),
    };

    this.courses.push(course);

    return course;
  }

  findAll(): Course[] {
    return this.courses;
  }

  findById(id: string): Course | undefined {
    return this.courses.find((course) => course.id === id);
  }

  update(id: string, input: UpdateCourseInput): Course | undefined {
    const course = this.courses.find((course) => course.id === id);

    if (!course) {
      return undefined;
    }

    Object.assign(course, input);

    return course;
  }

  delete(id: string): boolean {
    const courseIndex = this.courses.findIndex((course) => course.id === id);

    if (courseIndex === -1) {
      return false;
    }

    this.courses.splice(courseIndex, 1);

    return true;
  }
}
