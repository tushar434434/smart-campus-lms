import { PrismaClient } from '../../generated/prisma/client.js';
import type {
  CreateCourseInput,
  UpdateCourseInput,
  ListCoursesInput,
} from './course.schema.js';
import type { Course, CourseApprovalStatus } from './course.repository.js';
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

  private toCourse(course: {
    id: string;
    ownerFacultyId: string | null;
    approvalStatus: CourseApprovalStatus;
    rejectionReason: string | null;
    reviewedAt: Date | null;
    reviewedById: string | null;
    title: string;
    code: string;
    credits: number;
    createdAt: Date;
  }): Course {
    return {
      id: course.id,
      ownerFacultyId: course.ownerFacultyId,
      approvalStatus: course.approvalStatus,
      rejectionReason: course.rejectionReason,
      reviewedAt: course.reviewedAt?.toISOString() ?? null,
      reviewedById: course.reviewedById,
      title: course.title,
      code: course.code,
      credits: course.credits,
      createdAt: course.createdAt.toISOString(),
    };
  }

  async create(
    input: CreateCourseInput,
    ownerFacultyId?: string,
  ): Promise<Course> {
    try {
      const course = await this.prisma.course.create({
        data: {
          ...input,
          ownerFacultyId: ownerFacultyId ?? null,
          approvalStatus: 'pending',
        },
      });

      return this.toCourse(course);
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
    ownerFacultyId?: string,
    approvalStatus?: CourseApprovalStatus | 'all',
  ): Promise<{ courses: Course[]; total: number }> {
    const { page, limit, search, credits } = input;

    const where = {
      ...(ownerFacultyId !== undefined && { ownerFacultyId }),
      ...(approvalStatus !== undefined &&
        approvalStatus !== 'all' && { approvalStatus }),
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
      courses: courses.map((course) => this.toCourse(course)),
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

    return this.toCourse(course);
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

      return this.toCourse(course);
    } catch (error) {
      if (isPrismaErrorCode(error, 'P2025')) {
        return undefined;
      }

      throw error;
    }
  }

  async setOwnerFacultyId(
    id: string,
    ownerFacultyId: string | null,
  ): Promise<Course | undefined> {
    try {
      const course = await this.prisma.course.update({
        where: { id },
        data: { ownerFacultyId },
      });

      return this.toCourse(course);
    } catch (error) {
      if (isPrismaErrorCode(error, 'P2025')) return undefined;
      throw error;
    }
  }

  async approvePending(
    id: string,
    reviewerId: string,
  ): Promise<Course | undefined> {
    const result = await this.prisma.course.updateMany({
      where: { id, approvalStatus: 'pending' },
      data: {
        approvalStatus: 'approved',
        rejectionReason: null,
        reviewedAt: new Date(),
        reviewedById: reviewerId,
      },
    });
    return result.count === 1 ? this.findById(id) : undefined;
  }

  async rejectPending(
    id: string,
    reviewerId: string,
    reason: string,
  ): Promise<Course | undefined> {
    const result = await this.prisma.course.updateMany({
      where: { id, approvalStatus: 'pending' },
      data: {
        approvalStatus: 'rejected',
        rejectionReason: reason,
        reviewedAt: new Date(),
        reviewedById: reviewerId,
      },
    });
    return result.count === 1 ? this.findById(id) : undefined;
  }

  async resubmitRejected(
    id: string,
    ownerFacultyId: string,
  ): Promise<Course | undefined> {
    const result = await this.prisma.course.updateMany({
      where: {
        id,
        ownerFacultyId,
        approvalStatus: 'rejected',
      },
      data: {
        approvalStatus: 'pending',
        rejectionReason: null,
        reviewedAt: null,
        reviewedById: null,
      },
    });
    return result.count === 1 ? this.findById(id) : undefined;
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
