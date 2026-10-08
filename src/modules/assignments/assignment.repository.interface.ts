import type { Assignment } from './assignment.repository.js';

export type { Assignment };

export interface AssignmentRepository {
  create(
    input: Omit<Assignment, 'id' | 'createdAt'>,
  ): Promise<Assignment>;

  findAllByCourseId(courseId: string): Promise<Assignment[]>;

  findById(id: string): Promise<Assignment | undefined>;

  update(
    id: string,
    input: Partial<Omit<Assignment, 'id' | 'courseId' | 'createdAt'>>,
  ): Promise<Assignment | undefined>;

  delete(id: string): Promise<boolean>;
}