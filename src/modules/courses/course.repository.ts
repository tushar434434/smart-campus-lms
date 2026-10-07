import type {
  CreateCourseInput,
  UpdateCourseInput,
  ListCoursesInput,
} from './course.schema.js';

import type { CourseRepository } from './course.repository.interface.js';

export interface Course extends CreateCourseInput {
  id: string;
  createdAt: string;
}

export class InMemoryCourseRepository implements CourseRepository {
  private courses: Course[] = [];

  async create(input: CreateCourseInput): Promise<Course> {
    const course: Course = {
      id: crypto.randomUUID(),
      ...input,
      createdAt: new Date().toISOString(),
    };

    this.courses.push(course);

    return course;
  }

  async findAll(input: ListCoursesInput): Promise<{
    courses: Course[];
    total: number;
  }> {
    const { page, limit, search, credits } = input;

    let filteredCourses = this.courses;

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

    Object.assign(course, input);

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
