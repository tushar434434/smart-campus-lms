import { randomUUID } from 'node:crypto';

import type { AssignmentRepository } from './assignment.repository.interface.js';

export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  description: string;
  dueAt: string;
  maxMarks: number;
  createdAt: string;
}

export class InMemoryAssignmentRepository implements AssignmentRepository {
  private assignments: Assignment[] = [];

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

    return true;
  }
}