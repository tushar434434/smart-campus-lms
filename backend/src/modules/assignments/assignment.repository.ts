import { randomUUID } from 'node:crypto';

import type { AssignmentRepository } from './assignment.repository.interface.js';

export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  description: string;
  dueAt: string;
  maxMarks: number;
  file?: {
    originalFileName: string;
    mimeType: string;
    size: number;
  };
  createdAt: string;
}

export class InMemoryAssignmentRepository implements AssignmentRepository {
  private assignments: Assignment[] = [];
  private readonly fileKeys = new Map<string, string>();

  async create(
    input: Omit<Assignment, 'id' | 'createdAt'>,
  ): Promise<Assignment> {
    const assignment: Assignment = {
      id: randomUUID(),
      ...input,
      createdAt: new Date().toISOString(),
    };

    this.assignments.push(assignment);

    return assignment;
  }

  async findAllByCourseId(courseId: string): Promise<Assignment[]> {
    return this.assignments.filter(
      (assignment) => assignment.courseId === courseId,
    );
  }

  async findById(id: string): Promise<Assignment | undefined> {
    return this.assignments.find((assignment) => assignment.id === id);
  }

  async update(
    id: string,
    input: Partial<Omit<Assignment, 'id' | 'courseId' | 'createdAt'>>,
  ): Promise<Assignment | undefined> {
    const assignment = this.assignments.find(
      (assignment) => assignment.id === id,
    );

    if (!assignment) {
      return undefined;
    }

    Object.assign(assignment, input);

    return assignment;
  }

  async delete(id: string): Promise<boolean> {
    const index = this.assignments.findIndex(
      (assignment) => assignment.id === id,
    );

    if (index === -1) {
      return false;
    }

    this.assignments.splice(index, 1);
    this.fileKeys.delete(id);

    return true;
  }

  async attachFile(
    id: string,
    file: {
      key: string;
      mimeType: string;
      size: number;
      originalFileName: string;
    },
  ): Promise<Assignment | undefined> {
    const assignment = this.assignments.find((item) => item.id === id);
    if (!assignment) return undefined;
    this.fileKeys.set(id, file.key);
    assignment.file = {
      mimeType: file.mimeType,
      size: file.size,
      originalFileName: file.originalFileName,
    };
    return assignment;
  }

  async findStoredFile(
    id: string,
  ): Promise<
    | { key: string; mimeType: string; size: number; originalFileName: string }
    | undefined
  > {
    const assignment = this.assignments.find((item) => item.id === id);
    const key = this.fileKeys.get(id);
    if (!assignment?.file || !key) return undefined;
    return { key, ...assignment.file };
  }
}
