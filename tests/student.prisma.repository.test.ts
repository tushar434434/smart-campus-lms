import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaStudentRepository } from '../src/modules/students/student.prisma.repository';
import { Prisma } from '../src/generated/prisma/client';

const {
  findUnique,
  update,
  delete: deleteStudent,
} = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../src/generated/prisma/client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../src/generated/prisma/client')>();

  return {
    ...actual,
    PrismaClient: vi.fn().mockImplementation(() => ({
      student: {
        findUnique,
        update,
        delete: deleteStudent,
      },
    })),
  };
});

describe('PrismaStudentRepository', () => {
  let repository: PrismaStudentRepository;

  beforeEach(() => {
    vi.clearAllMocks();

    repository = new PrismaStudentRepository({
      student: {
        findUnique,
        update,
        delete: deleteStudent,
      },
    } as never);
  });

  it('findByUserId returns a student when found', async () => {
    const student = {
      id: 'student-1',
      userId: 'user-1',
      name: 'Test Student',
      email: 'student@example.com',
      enrollmentNumber: 'ENR001',
      department: 'CSE',
      semester: 5,
      createdAt: new Date(),
    };

    findUnique.mockResolvedValue(student);

    await expect(repository.findByUserId('user-1')).resolves.toEqual({
      ...student,
      createdAt: student.createdAt.toISOString(),
    });

    expect(findUnique).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
  });

  it('findByUserId returns undefined when no student is found', async () => {
    findUnique.mockResolvedValue(null);

    await expect(
      repository.findByUserId('missing-user'),
    ).resolves.toBeUndefined();
  });

  it('linkUser returns the linked student on success', async () => {
    const student = {
      id: 'student-1',
      userId: 'user-1',
      name: 'Test Student',
      email: 'student@example.com',
      enrollmentNumber: 'ENR001',
      department: 'CSE',
      semester: 5,
      createdAt: new Date(),
    };

    update.mockResolvedValue(student);

    await expect(repository.linkUser('student-1', 'user-1')).resolves.toEqual({
      ...student,
      createdAt: student.createdAt.toISOString(),
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'student-1' },
      data: { user: { connect: { id: 'user-1' } } },
    });
  });

  it('linkUser returns undefined when the student does not exist', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: 'test',
    });

    update.mockRejectedValue(error);

    await expect(
      repository.linkUser('missing-student', 'user-1'),
    ).resolves.toBeUndefined();
  });

  it('update rethrows unexpected database errors', async () => {
    const error = new Error('Database connection failed');

    update.mockRejectedValue(error);

    await expect(
      repository.update('student-1', { name: 'Updated Name' }),
    ).rejects.toBe(error);
  });

  it('delete rethrows unexpected database errors', async () => {
    const error = new Error('Database connection failed');

    deleteStudent.mockRejectedValue(error);

    await expect(repository.delete('student-1')).rejects.toBe(error);
  });
});
