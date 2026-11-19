import type {
  CourseMaterial,
  CreateCourseMaterialRecord,
} from './course-material.repository.js';

export interface CourseMaterialRepository {
  create(input: CreateCourseMaterialRecord): Promise<CourseMaterial>;
  findById(id: string): Promise<CourseMaterial | undefined>;
  findByCourseId(courseId: string): Promise<CourseMaterial[]>;
  delete(id: string): Promise<boolean>;
}
