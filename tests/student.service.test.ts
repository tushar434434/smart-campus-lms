import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStudentService } from '../src/modules/students/student.service.js';
import type { StudentRepository } from '../src/modules/students/student.repository.interface.js';
import type { AuthRepository } from '../src/modules/auth/auth.repository.interface.js';
import type { Student } from '../src/modules/students/student.repository.js';
import type { User } from '../src/modules/auth/auth.schema.js';

describe('Student service - linkStudentUser', () => {
  let studentRepository: StudentRepository;
  let authRepository: AuthRepository;
  let service: ReturnType<typeof createStudentService>;

  const student: Student = {
    id: 'student-1',
    userId: null,
    name: 'Test Student',
    email: 'student@example.com',
    enrollmentNumber: 'ENR001',
    department: 'CSE',
    semester: 5,
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const user: User = {
    id: 'user-1',
    name: 'Test User',
    email: 'user@example.com',
    passwordHash: 'hashed-password',
    role: 'student',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    studentRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findByEmail: vi.fn(),
      findByEnrollmentNumber: vi.fn(),
      findByUserId: vi.fn(),
      linkUser: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      findAll: vi.fn(),
    };

    authRepository = {
      create: vi.fn(),
      findByEmail: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
    };

    service = createStudentService(studentRepository, authRepository);
  });

  it('throws when authentication repository is not configured', async () => {
    const serviceWithoutAuth = createStudentService(studentRepository);

    await expect(
      serviceWithoutAuth.linkStudentUser('student-1', 'user-1'),
    ).rejects.toMatchObject({
      statusCode: 500,
      code: 'AUTH_REPOSITORY_NOT_CONFIGURED',
    });
  });

  it('throws when the student does not exist', async () => {
    vi.mocked(studentRepository.findById).mockResolvedValue(undefined);

    await expect(
      service.linkStudentUser('student-1', 'user-1'),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'STUDENT_NOT_FOUND',
    });
  });

  it('throws when the user does not exist', async () => {
    vi.mocked(studentRepository.findById).mockResolvedValue(student);
    vi.mocked(authRepository.findById).mockResolvedValue(undefined);

    await expect(
      service.linkStudentUser('student-1', 'user-1'),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'USER_NOT_FOUND',
    });
  });

  it('rejects a user who is not a student', async () => {
    vi.mocked(studentRepository.findById).mockResolvedValue(student);
    vi.mocked(authRepository.findById).mockResolvedValue({
      ...user,
      role: 'faculty',
    });

    await expect(
      service.linkStudentUser('student-1', 'user-1'),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_USER_ROLE',
    });
  });

  it('rejects a student who already has a linked account', async () => {
    vi.mocked(studentRepository.findById).mockResolvedValue({
      ...student,
      userId: 'existing-user',
    });

    vi.mocked(authRepository.findById).mockResolvedValue(user);

    await expect(
      service.linkStudentUser('student-1', 'user-1'),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'STUDENT_ALREADY_LINKED',
    });

    expect(studentRepository.linkUser).not.toHaveBeenCalled();
  });

  it('rejects a user already linked to another student', async () => {
    vi.mocked(studentRepository.findById).mockResolvedValue(student);
    vi.mocked(authRepository.findById).mockResolvedValue(user);
    vi.mocked(studentRepository.findByUserId).mockResolvedValue({
      ...student,
      id: 'another-student',
      userId: 'user-1',
    });

    await expect(
      service.linkStudentUser('student-1', 'user-1'),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'USER_ALREADY_LINKED',
    });

    expect(studentRepository.linkUser).not.toHaveBeenCalled();
  });

  it('successfully links a student account', async () => {
    const linkedStudent = { ...student, userId: 'user-1' };

    vi.mocked(studentRepository.findById).mockResolvedValue(student);
    vi.mocked(authRepository.findById).mockResolvedValue(user);
    vi.mocked(studentRepository.findByUserId).mockResolvedValue(undefined);
    vi.mocked(studentRepository.linkUser).mockResolvedValue(linkedStudent);

    await expect(
      service.linkStudentUser('student-1', 'user-1'),
    ).resolves.toEqual(linkedStudent);

    expect(studentRepository.linkUser).toHaveBeenCalledWith(
      'student-1',
      'user-1',
    );
  });

  it('throws when linking fails in the repository', async () => {
    vi.mocked(studentRepository.findById).mockResolvedValue(student);
    vi.mocked(authRepository.findById).mockResolvedValue(user);
    vi.mocked(studentRepository.findByUserId).mockResolvedValue(undefined);
    vi.mocked(studentRepository.linkUser).mockResolvedValue(undefined);

    await expect(
      service.linkStudentUser('student-1', 'user-1'),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'STUDENT_LINK_FAILED',
    });
  });
});
