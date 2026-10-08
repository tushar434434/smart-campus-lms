import type { CreateStudentInput } from './student.schema.js';
import type { Student } from './student.repository.js';

export interface StudentRepository {
  create(input: CreateStudentInput): Promise<Student>;

  findById(id: string): Promise<Student | undefined>;

  findByEmail(email: string): Promise<Student | undefined>;

  delete(id: string): Promise<boolean>;

  findByEnrollmentNumber(
    enrollmentNumber: string,
  ): Promise<Student | undefined>;

  update(
    id: string,
    input: {
      name?: string | undefined;
      email?: string | undefined;
      enrollmentNumber?: string | undefined;
      department?: string | undefined;
      semester?: number | undefined;
    },
  ): Promise<Student | undefined>;

  findAll(input: {
    page: number;
    limit: number;
    search?: string | undefined;
  }): Promise<{
    students: Student[];
    total: number;
  }>;
}
