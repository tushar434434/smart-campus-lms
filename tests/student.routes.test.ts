import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { createTestContainer } from '../src/test-container.js';

describe('Student API', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    const container = createTestContainer();

    app = buildApp(container);

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  async function createStudent(
    overrides: Partial<{
      name: string;
      email: string;
      enrollmentNumber: string;
      department: string;
      semester: number;
    }> = {},
  ) {
    const response = await app.inject({
      method: 'POST',
      url: '/students',
      payload: {
        name: 'Test Student',
        email: 'test.student@example.com',
        enrollmentNumber: 'TEST2026101',
        department: 'CSE',
        semester: 5,
        ...overrides,
      },
    });

    expect(response.statusCode).toBe(201);
    return response.json().data;
  }

  async function createUser(
    role: 'student' | 'faculty' = 'student',
    email = `${role}.${crypto.randomUUID()}@example.com`,
  ) {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        name: `${role} Test User`,
        email,
        password: 'TestPassword123!',
        role,
      },
    });

    expect(response.statusCode).toBe(201);
    return response.json().data;
  }

  async function tokenFor(
    role: 'student' | 'faculty' | 'admin',
  ): Promise<string> {
    const user = await createUser(
      role === 'admin' ? 'faculty' : role,
      `${role}.${crypto.randomUUID()}@example.com`,
    );

    return app.jwt.sign({
      sub: user.id,
      role,
    });
  }

  async function linkStudent(
    studentId: string,
    userId: string,
    token?: string,
  ) {
    return app.inject({
      method: 'PATCH',
      url: `/students/${studentId}/link-user`,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      payload: { userId },
    });
  }

  it('should delete a student successfully', async () => {
    const student = await createStudent({
      name: 'Delete Student',
      email: 'delete.student@example.com',
      enrollmentNumber: 'DEL2026101',
    });

    const response = await app.inject({
      method: 'DELETE',
      url: `/students/${student.id}`,
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');

    const getResponse = await app.inject({
      method: 'GET',
      url: `/students/${student.id}`,
    });

    expect(getResponse.statusCode).toBe(404);
  });

  it('should return 404 when deleting a non-existent student', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/students/non-existent-id',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('STUDENT_NOT_FOUND');
  });

  it('should update a student successfully', async () => {
    const student = await createStudent({
      name: 'Rahul Sharma',
      email: 'rahul.update@example.com',
      enrollmentNumber: 'ENR2026101',
    });

    const response = await app.inject({
      method: 'PATCH',
      url: `/students/${student.id}`,
      payload: {
        semester: 6,
        department: 'AI & ML',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.semester).toBe(6);
    expect(response.json().data.department).toBe('AI & ML');
    expect(response.json().data.name).toBe('Rahul Sharma');
  });

  it('should return 404 when updating a non-existent student', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/students/non-existent-id',
      payload: { semester: 6 },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('STUDENT_NOT_FOUND');
  });

  it('should reject an empty update payload', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/students/any-id',
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject updating to an existing email', async () => {
    await createStudent({
      name: 'Rahul Sharma',
      email: 'rahul.one@example.com',
      enrollmentNumber: 'ENR2026201',
    });

    const second = await createStudent({
      name: 'Aman Verma',
      email: 'aman.two@example.com',
      enrollmentNumber: 'ENR2026202',
      department: 'IT',
      semester: 4,
    });

    const response = await app.inject({
      method: 'PATCH',
      url: `/students/${second.id}`,
      payload: { email: 'rahul.one@example.com' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('STUDENT_EMAIL_EXISTS');
  });

  it('should reject updating to an existing enrollment number', async () => {
    await createStudent({
      name: 'Neha Sharma',
      email: 'neha.one@example.com',
      enrollmentNumber: 'ENR2026301',
    });

    const second = await createStudent({
      name: 'Karan Verma',
      email: 'karan.two@example.com',
      enrollmentNumber: 'ENR2026302',
      department: 'IT',
      semester: 4,
    });

    const response = await app.inject({
      method: 'PATCH',
      url: `/students/${second.id}`,
      payload: { enrollmentNumber: 'ENR2026301' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('STUDENT_ENROLLMENT_EXISTS');
  });

  it('should list students with pagination metadata', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/students?page=1&limit=5',
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('students');
    expect(body.data.pagination.page).toBe(1);
    expect(body.data.pagination.limit).toBe(5);
    expect(typeof body.data.pagination.total).toBe('number');
    expect(typeof body.data.pagination.totalPages).toBe('number');
  });

  it('should search students by name', async () => {
    await createStudent({
      name: 'UniqueSearchStudent',
      email: 'unique.search@example.com',
      enrollmentNumber: 'AI2026010',
      department: 'AI-ML',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/students?search=UniqueSearchStudent',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.students).toHaveLength(1);
    expect(response.json().data.students[0].name).toBe('UniqueSearchStudent');
  });

  it('should reject an invalid page number', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/students?page=0',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject a limit greater than 100', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/students?limit=101',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 404 when student does not exist', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/students/non-existent-id',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('STUDENT_NOT_FOUND');
  });

  it('should retrieve a student by ID', async () => {
    const student = await createStudent({
      name: 'Aman Kumar',
      email: 'aman@example.com',
      enrollmentNumber: 'AI2026003',
      department: 'AI-ML',
    });

    const response = await app.inject({
      method: 'GET',
      url: `/students/${student.id}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);
    expect(response.json().data.id).toBe(student.id);
    expect(response.json().data.name).toBe('Aman Kumar');
  });

  it('should reject invalid student data', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/students',
      payload: {
        name: 'R',
        email: 'invalid-email',
        enrollmentNumber: 'AI1',
        department: 'AI',
        semester: 10,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('should trim student name, email, and department when creating', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/students',
      payload: {
        name: '  Trimmed Student  ',
        email: '  trimmed.student@example.com  ',
        enrollmentNumber: 'TRIM2026101',
        department: '  CSE  ',
        semester: 5,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.name).toBe('Trimmed Student');
    expect(response.json().data.email).toBe('trimmed.student@example.com');
    expect(response.json().data.department).toBe('CSE');
  });

  it('should reject a student name longer than 100 characters', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/students',
      payload: {
        name: 'A'.repeat(101),
        email: 'long.name@example.com',
        enrollmentNumber: 'LONG2026101',
        department: 'CSE',
        semester: 5,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject a student name shorter than 3 characters after trimming', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/students',
      payload: {
        name: ' A ',
        email: 'short.name@example.com',
        enrollmentNumber: 'SHORT2026101',
        department: 'CSE',
        semester: 5,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('should register a student successfully', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/students',
      payload: {
        name: 'Rahul Sharma',
        email: 'rahul@example.com',
        enrollmentNumber: 'AI2026001',
        department: 'AI-ML',
        semester: 5,
      },
    });

    expect(response.statusCode).toBe(201);

    const body = response.json();

    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Rahul Sharma');
    expect(body.data.email).toBe('rahul@example.com');
  });

  it('should reject duplicate email', async () => {
    const student = {
      name: 'Rahul Sharma',
      email: 'rahul@example.com',
      enrollmentNumber: 'AI2026001',
      department: 'AI-ML',
      semester: 5,
    };

    await app.inject({
      method: 'POST',
      url: '/students',
      payload: student,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/students',
      payload: {
        ...student,
        enrollmentNumber: 'AI2026002',
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('STUDENT_EMAIL_EXISTS');
  });

  it('should link a student record to a student user account', async () => {
    const student = await createStudent({
      email: 'linked.student@example.com',
      enrollmentNumber: 'LINK2026101',
    });

    const user = await createUser();
    const token = await tokenFor('faculty');

    const response = await linkStudent(student.id, user.id, token);

    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);
    expect(response.json().data.id).toBe(student.id);
    expect(response.json().data.userId).toBe(user.id);
  });

  it('should require authentication to link a student account', async () => {
    const student = await createStudent();
    const user = await createUser();

    const response = await linkStudent(student.id, user.id);

    expect(response.statusCode).toBe(401);
  });

  it('should reject a student token when linking an account', async () => {
    const student = await createStudent();
    const user = await createUser();
    const token = await tokenFor('student');

    const response = await linkStudent(student.id, user.id, token);

    expect(response.statusCode).toBe(403);
  });

  it('should return 404 when linking a non-existent student', async () => {
    const user = await createUser();
    const token = await tokenFor('faculty');

    const response = await linkStudent(
      '00000000-0000-4000-8000-000000000001',
      user.id,
      token,
    );

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('STUDENT_NOT_FOUND');
  });

  it('should return 404 when linking a non-existent user', async () => {
    const student = await createStudent();
    const token = await tokenFor('faculty');

    const response = await linkStudent(
      student.id,
      '00000000-0000-4000-8000-000000000002',
      token,
    );

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('USER_NOT_FOUND');
  });

  it('should reject linking a faculty account to a student record', async () => {
    const student = await createStudent();
    const faculty = await createUser('faculty');
    const token = await tokenFor('faculty');

    const response = await linkStudent(student.id, faculty.id, token);

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('INVALID_USER_ROLE');
  });

  it('should reject linking a student that already has an account', async () => {
    const student = await createStudent();
    const firstUser = await createUser();
    const secondUser = await createUser();
    const token = await tokenFor('faculty');

    const firstResponse = await linkStudent(student.id, firstUser.id, token);

    expect(firstResponse.statusCode).toBe(200);

    const secondResponse = await linkStudent(student.id, secondUser.id, token);

    expect(secondResponse.statusCode).toBe(409);
    expect(secondResponse.json().error.code).toBe('STUDENT_ALREADY_LINKED');
  });

  it('should reject linking a user already linked to another student', async () => {
    const firstStudent = await createStudent({
      email: 'first.link@example.com',
      enrollmentNumber: 'LINK2026201',
    });

    const secondStudent = await createStudent({
      email: 'second.link@example.com',
      enrollmentNumber: 'LINK2026202',
    });

    const user = await createUser();
    const token = await tokenFor('faculty');

    const firstResponse = await linkStudent(firstStudent.id, user.id, token);

    expect(firstResponse.statusCode).toBe(200);

    const secondResponse = await linkStudent(secondStudent.id, user.id, token);

    expect(secondResponse.statusCode).toBe(409);
    expect(secondResponse.json().error.code).toBe('USER_ALREADY_LINKED');
  });

  it('should reject an invalid user ID when linking', async () => {
    const student = await createStudent();
    const token = await tokenFor('faculty');

    const response = await linkStudent(student.id, 'not-a-valid-uuid', token);

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject an invalid email when updating a student', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/students/any-id',
      payload: { email: 'invalid-email' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject a zero pagination limit', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/students?limit=0',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });
});
