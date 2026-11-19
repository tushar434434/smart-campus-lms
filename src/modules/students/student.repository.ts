import type { CreateStudentInput } from './student.schema.js';
import type { StudentRepository } from './student.repository.interface.js';

export interface Student extends CreateStudentInput {
  id: string;
  userId: string | null;
  createdAt: string;
}

export class InMemoryStudentRepository implements StudentRepository {
  private students: Student[] = [];

  async create(input: CreateStudentInput): Promise<Student> {
    const student: Student = {
      id: crypto.randomUUID(),
      ...input,
      userId: null,
      createdAt: new Date().toISOString(),
    };

    this.students.push(student);
    return student;
  }

  async findById(id: string): Promise<Student | undefined> {
    return this.students.find((student) => student.id === id);
  }

  async findByEmail(email: string): Promise<Student | undefined> {
    return this.students.find(
      (student) => student.email.toLowerCase() === email.toLowerCase(),
    );
  }

  async findByEnrollmentNumber(
    enrollmentNumber: string,
  ): Promise<Student | undefined> {
    return this.students.find(
      (student) => student.enrollmentNumber === enrollmentNumber,
    );
  }

  async findByUserId(userId: string): Promise<Student | undefined> {
    return this.students.find((student) => student.userId === userId);
  }

  async findLinkedUserIds(): Promise<string[]> {
    return this.students.flatMap((student) =>
      student.userId ? [student.userId] : [],
    );
  }

  async linkUser(
    studentId: string,
    userId: string,
  ): Promise<Student | undefined> {
    const student = this.students.find((item) => item.id === studentId);

    if (!student) return undefined;

    const alreadyLinked = this.students.some(
      (item) => item.userId === userId && item.id !== studentId,
    );

    if (alreadyLinked) {
      throw new Error('User is already linked to another student');
    }

    student.userId = userId;
    return student;
  }

  async delete(id: string): Promise<boolean> {
    const index = this.students.findIndex((student) => student.id === id);

    if (index === -1) return false;

    this.students.splice(index, 1);
    return true;
  }

  async update(
    id: string,
    input: Partial<CreateStudentInput>,
  ): Promise<Student | undefined> {
    const index = this.students.findIndex((student) => student.id === id);

    if (index === -1) return undefined;

    const updatedStudent: Student = {
      ...this.students[index]!,
      ...input,
    };

    this.students[index] = updatedStudent;
    return updatedStudent;
  }

  async findAll(input: {
    page: number;
    limit: number;
    search?: string;
  }): Promise<{ students: Student[]; total: number }> {
    let filteredStudents = [...this.students];

    if (input.search) {
      const term = input.search.toLowerCase();

      filteredStudents = filteredStudents.filter(
        (student) =>
          student.name.toLowerCase().includes(term) ||
          student.email.toLowerCase().includes(term) ||
          student.enrollmentNumber.toLowerCase().includes(term),
      );
    }

    const total = filteredStudents.length;
    const startIndex = (input.page - 1) * input.limit;

    return {
      students: filteredStudents.slice(startIndex, startIndex + input.limit),
      total,
    };
  }
}
