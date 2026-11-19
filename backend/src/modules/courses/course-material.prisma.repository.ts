import { PrismaClient } from '../../generated/prisma/client.js';
import type { CourseMaterialType } from './course-material.schema.js';
import type {
  CourseMaterial,
  CreateCourseMaterialRecord,
} from './course-material.repository.js';
import type { CourseMaterialRepository } from './course-material.repository.interface.js';

export class PrismaCourseMaterialRepository implements CourseMaterialRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateCourseMaterialRecord): Promise<CourseMaterial> {
    const material = await this.prisma.courseMaterial.create({ data: input });
    return this.toMaterial(material);
  }

  async findById(id: string): Promise<CourseMaterial | undefined> {
    const material = await this.prisma.courseMaterial.findUnique({
      where: { id },
    });
    return material ? this.toMaterial(material) : undefined;
  }

  async findByCourseId(courseId: string): Promise<CourseMaterial[]> {
    const materials = await this.prisma.courseMaterial.findMany({
      where: { courseId },
      orderBy: [{ unitNumber: 'asc' }, { createdAt: 'asc' }],
    });
    return materials.map((material) => this.toMaterial(material));
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.courseMaterial.delete({ where: { id } });
      return true;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2025'
      ) {
        return false;
      }
      throw error;
    }
  }

  private toMaterial(material: {
    id: string;
    courseId: string;
    uploadedById: string;
    title: string;
    description: string | null;
    unitNumber: number | null;
    type: CourseMaterialType;
    originalFileName: string;
    fileKey: string;
    fileMimeType: string;
    fileSize: number;
    createdAt: Date;
  }): CourseMaterial {
    return { ...material, createdAt: material.createdAt.toISOString() };
  }
}
