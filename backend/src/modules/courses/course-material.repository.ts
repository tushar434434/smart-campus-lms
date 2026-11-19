import { randomUUID } from 'node:crypto';
import type { CourseMaterialType } from './course-material.schema.js';
import type { CourseMaterialRepository } from './course-material.repository.interface.js';

export interface CourseMaterial {
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
  createdAt: string;
}

export type CreateCourseMaterialRecord = Omit<
  CourseMaterial,
  'id' | 'createdAt'
>;

export class InMemoryCourseMaterialRepository implements CourseMaterialRepository {
  private readonly materials: CourseMaterial[] = [];

  async create(input: CreateCourseMaterialRecord): Promise<CourseMaterial> {
    const material = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.materials.push(material);
    return material;
  }

  async findById(id: string): Promise<CourseMaterial | undefined> {
    return this.materials.find((material) => material.id === id);
  }

  async findByCourseId(courseId: string): Promise<CourseMaterial[]> {
    return this.materials
      .filter((material) => material.courseId === courseId)
      .sort((left, right) => {
        const unitDiff = (left.unitNumber ?? 0) - (right.unitNumber ?? 0);
        return unitDiff || left.createdAt.localeCompare(right.createdAt);
      });
  }

  async delete(id: string): Promise<boolean> {
    const index = this.materials.findIndex((material) => material.id === id);
    if (index < 0) return false;
    this.materials.splice(index, 1);
    return true;
  }
}
