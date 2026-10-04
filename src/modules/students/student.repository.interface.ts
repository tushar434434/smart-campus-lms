import type { CreateStudentInput } from './student.schema.js';
import type { Student } from './student.repository.js';

export interface StudentRepository {
  create(input: CreateStudentInput): Student;

  findById(id: string): Student | undefined;

  findByEmail(email: string): Student | undefined;

  findByEnrollmentNumber(enrollmentNumber: string): Student | undefined;

  findAll(input: {
    page: number;
    limit: number;
    search?: string | undefined;
  }): {
    students: Student[];
    total: number;
  };
}
