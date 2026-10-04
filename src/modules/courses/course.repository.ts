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

  create(input: CreateCourseInput): Course {
    const course: Course = {
      id: crypto.randomUUID(),
      ...input,
      createdAt: new Date().toISOString(),
    };

    this.courses.push(course);

    return course;
  }

  findAll(input: ListCoursesInput): {
    courses: Course[];
    total: number;
  } {
    const { page, limit, search, credits } = input;

    let filteredCourses = this.courses;

    // Search by course title or code
    if (search) {
      const searchTerm = search.toLowerCase();

      filteredCourses = filteredCourses.filter(
        (course) =>
          course.title.toLowerCase().includes(searchTerm) ||
          course.code.toLowerCase().includes(searchTerm),
      );
    }

    // Filter by credits
    if (credits !== undefined) {
      filteredCourses = filteredCourses.filter(
        (course) => course.credits === credits,
      );
    }

    // Total matching courses before pagination
    const total = filteredCourses.length;

    // Calculate pagination offset
    const startIndex = (page - 1) * limit;

    // Return only the requested page
    const courses = filteredCourses.slice(startIndex, startIndex + limit);

    return {
      courses,
      total,
    };
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
