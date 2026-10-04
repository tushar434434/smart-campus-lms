import type { CreateStudentInput } from './student.schema.js';
import type { StudentRepository } from './student.repository.interface.js';

export interface Student extends CreateStudentInput {
  id: string;
  createdAt: string;
}

export class InMemoryStudentRepository implements StudentRepository {
  update(id: string, input: Partial<CreateStudentInput>): Student | undefined {
    const studentIndex = this.students.findIndex(
      (student) => student.id === id,
    );

    if (studentIndex === -1) {
      return undefined;
    }

    const updatedStudent: Student = {
      ...this.students[studentIndex]!,
      ...input,
    };

    this.students[studentIndex] = updatedStudent;

    return updatedStudent;
  }
  findAll(input: { page: number; limit: number; search?: string }): {
    students: Student[];
    total: number;
  } {
    let filteredStudents = [...this.students];

    if (input.search) {
      const searchTerm = input.search.toLowerCase();

      filteredStudents = filteredStudents.filter(
        (student) =>
          student.name.toLowerCase().includes(searchTerm) ||
          student.email.toLowerCase().includes(searchTerm) ||
          student.enrollmentNumber.toLowerCase().includes(searchTerm),
      );
    }

    const total = filteredStudents.length;

    const startIndex = (input.page - 1) * input.limit;

    const students = filteredStudents.slice(
      startIndex,
      startIndex + input.limit,
    );

    return { students, total };
  }
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
