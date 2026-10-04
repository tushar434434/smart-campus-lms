import { randomUUID } from 'node:crypto';

import type {
  Assignment,
  AssignmentRepository,
} from './assignment.repository.interface.js';

export class InMemoryAssignmentRepository implements AssignmentRepository {
  private assignments: Assignment[] = [];

  create(input: Omit<Assignment, 'id' | 'createdAt'>): Assignment {
    const assignment: Assignment = {
      id: randomUUID(),
      ...input,
      createdAt: new Date().toISOString(),
    };

    this.assignments.push(assignment);

    return assignment;
  }

  findAllByCourseId(courseId: string): Assignment[] {
    return this.assignments.filter(
      (assignment) => assignment.courseId === courseId,
    );
  }

  findById(id: string): Assignment | undefined {
    return this.assignments.find((assignment) => assignment.id === id);
  }

  update(
    id: string,
    input: Partial<Omit<Assignment, 'id' | 'courseId' | 'createdAt'>>,
  ): Assignment | undefined {
    const assignment = this.findById(id);

    if (!assignment) {
      return undefined;
    }

    Object.assign(assignment, input);

    return assignment;
  }

  delete(id: string): boolean {
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
