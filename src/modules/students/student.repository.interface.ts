import type { CreateStudentInput } from './student.schema.js';
import type { Student } from './student.repository.js';

export interface StudentRepository {
  create(input: CreateStudentInput): Promise<Student>;

  findById(id: string): Promise<Student | undefined>;

  findByEmail(email: string): Promise<Student | undefined>;

  findByEnrollmentNumber(
    enrollmentNumber: string,
  ): Promise<Student | undefined>;

  findByUserId(userId: string): Promise<Student | undefined>;

  findLinkedUserIds(): Promise<string[]>;

  linkUser(studentId: string, userId: string): Promise<Student | undefined>;

  delete(id: string): Promise<boolean>;

  update(
    id: string,
    input: {
      name?: string;
      email?: string;
      enrollmentNumber?: string;
      department?: string;
      semester?: number;
    },
  ): Promise<Student | undefined>;

  findAll(input: { page: number; limit: number; search?: string }): Promise<{
    students: Student[];
    total: number;
  }>;
}
