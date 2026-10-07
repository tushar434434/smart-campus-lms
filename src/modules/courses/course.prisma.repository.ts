import { PrismaClient } from '../../generated/prisma/client.js';

import type {
  CreateCourseInput,
  UpdateCourseInput,
  ListCoursesInput,
} from './course.schema.js';

import type { Course } from './course.repository.js';
import type { CourseRepository } from './course.repository.interface.js';

export class PrismaCourseRepository implements CourseRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateCourseInput): Promise<Course> {
    const course = await this.prisma.course.create({
      data: input,
    });

    return {
      id: course.id,
      title: course.title,
      code: course.code,
      credits: course.credits,
      createdAt: course.createdAt.toISOString(),
    };
  }

  async findAll(
    input: ListCoursesInput,
  ): Promise<{ courses: Course[]; total: number }> {
    const { page, limit, search, credits } = input;

    const where = {
      ...(search
        ? {
            OR: [
              {
                title: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
              {
                code: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
      ...(credits !== undefined ? { credits } : {}),
    };

    const [courses, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.course.count({ where }),
    ]);

    return {
      courses: courses.map((course) => ({
        id: course.id,
        title: course.title,
        code: course.code,
        credits: course.credits,
        createdAt: course.createdAt.toISOString(),
      })),
      total,
    };
  }

  async findById(id: string): Promise<Course | undefined> {
    const course = await this.prisma.course.findUnique({
      where: { id },
    });

    if (!course) {
      return undefined;
    }

    return {
      id: course.id,
      title: course.title,
      code: course.code,
      credits: course.credits,
      createdAt: course.createdAt.toISOString(),
    };
  }

  async update(
    id: string,
    input: UpdateCourseInput,
  ): Promise<Course | undefined> {
    const course = await this.prisma.course
      .update({
        where: { id },
        data: {
          ...(input.title !== undefined && {
            title: input.title,
          }),
          ...(input.code !== undefined && {
            code: input.code,
          }),
          ...(input.credits !== undefined && {
            credits: input.credits,
          }),
        },
      })
      .catch(() => null);

    if (!course) {
      return undefined;
    }

    return {
      id: course.id,
      title: course.title,
      code: course.code,
      credits: course.credits,
      createdAt: course.createdAt.toISOString(),
    };
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.course.delete({
        where: { id },
      });

      return true;
    } catch {
      return false;
    }
  }
}
