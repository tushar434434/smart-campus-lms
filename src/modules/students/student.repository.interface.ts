import type { CreateStudentInput } from './student.schema.js';
import type { Student } from './student.repository.js';

export interface StudentRepository {
  create(input: CreateStudentInput): Student;

  findById(id: string): Student | undefined;

  findByEmail(email: string): Student | undefined;
  delete(id: string): boolean;

  findByEnrollmentNumber(enrollmentNumber: string): Student | undefined;
  update(
    id: string,
    input: {
      name?: string | undefined;
      email?: string | undefined;
      enrollmentNumber?: string | undefined;
      department?: string | undefined;
      semester?: number | undefined;
    },
  ): Student | undefined;

  findAll(input: {
    page: number;
    limit: number;
    search?: string | undefined;
  }): {
    students: Student[];
    total: number;
  };
}
