import { PrismaClient } from '../../generated/prisma/client.js';
import type {
  CreateCourseInput,
  UpdateCourseInput,
  ListCoursesInput,
} from './course.schema.js';
import type { Course } from './course.repository.js';
import type { CourseRepository } from './course.repository.interface.js';

function isPrismaErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  );
}

export class PrismaCourseRepository implements CourseRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateCourseInput): Promise<Course> {
    try {
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
    } catch (error) {
      if (isPrismaErrorCode(error, 'P2002')) {
        const duplicateError = new Error('Course code already exists');
        Object.assign(duplicateError, {
          code: 'COURSE_CODE_EXISTS',
        });
        throw duplicateError;
      }

      throw error;
    }
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
      this.prisma.course.count({
        where,
      }),
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
    try {
      const course = await this.prisma.course.update({
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
      });

      return {
        id: course.id,
        title: course.title,
        code: course.code,
        credits: course.credits,
        createdAt: course.createdAt.toISOString(),
      };
    } catch (error) {
      if (isPrismaErrorCode(error, 'P2025')) {
        return undefined;
      }

      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.course.delete({
        where: { id },
      });

      return true;
    } catch (error) {
      if (isPrismaErrorCode(error, 'P2025')) {
        return false;
      }

      throw error;
    }
  }
}
