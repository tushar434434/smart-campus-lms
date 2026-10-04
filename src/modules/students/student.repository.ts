import type { CreateStudentInput } from './student.schema.js';
import type { StudentRepository } from './student.repository.interface.js';

export interface Student extends CreateStudentInput {
  id: string;
  createdAt: string;
}

export class InMemoryStudentRepository implements StudentRepository {
  private students: Student[] = [];

  create(input: CreateStudentInput): Student {
    const student: Student = {
      id: crypto.randomUUID(),
      ...input,
      createdAt: new Date().toISOString(),
    };

    this.students.push(student);

    return student;
  }

  findById(id: string): Student | undefined {
    return this.students.find((student) => student.id === id);
  }

  findByEmail(email: string): Student | undefined {
    return this.students.find(
      (student) => student.email.toLowerCase() === email.toLowerCase(),
    );
  }

  findByEnrollmentNumber(enrollmentNumber: string): Student | undefined {
    return this.students.find(
      (student) => student.enrollmentNumber === enrollmentNumber,
    );
  }
}
