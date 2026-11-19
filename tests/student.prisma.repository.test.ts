import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaStudentRepository } from '../src/modules/students/student.prisma.repository';
import { Prisma } from '../src/generated/prisma/client';

const {
  findUnique,
  findMany,
  update,
  updateMany,
  delete: deleteStudent,
} = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
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
        findMany,
        update,
        updateMany,
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
        findMany,
        update,
        updateMany,
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

    updateMany.mockResolvedValue({ count: 1 });
    findUnique.mockResolvedValue(student);

    await expect(repository.linkUser('student-1', 'user-1')).resolves.toEqual({
      ...student,
      createdAt: student.createdAt.toISOString(),
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'student-1', userId: null },
      data: { userId: 'user-1' },
    });
  });

  it('findLinkedUserIds returns only linked account IDs', async () => {
    findMany.mockResolvedValue([{ userId: 'user-1' }, { userId: null }]);

    await expect(repository.findLinkedUserIds()).resolves.toEqual(['user-1']);

    expect(findMany).toHaveBeenCalledWith({
      where: { userId: { not: null } },
      select: { userId: true },
    });
  });

  it('linkUser returns undefined when the student does not exist', async () => {
    updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repository.linkUser('missing-student', 'user-1'),
    ).resolves.toBeUndefined();
  });

  it('allows only one concurrent account assignment to a student', async () => {
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
    updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    findUnique.mockResolvedValue(student);

    const results = await Promise.all([
      repository.linkUser('student-1', 'user-1'),
      repository.linkUser('student-1', 'user-2'),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.filter((result) => result === undefined)).toHaveLength(1);
  });

  it('maps a unique-link race to a conflict response', async () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: 'test',
      },
    );

    updateMany.mockRejectedValue(error);

    await expect(
      repository.linkUser('student-1', 'user-1'),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'USER_ALREADY_LINKED',
    });
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
