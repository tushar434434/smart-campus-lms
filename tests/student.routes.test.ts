import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { createTestContainer } from '../src/test-container.js';

type Role = 'student' | 'faculty' | 'admin';

type StudentInput = {
  name: string;
  email: string;
  enrollmentNumber: string;
  department: string;
  semester: number;
};

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

  function uniqueId(): string {
    return crypto.randomUUID().replaceAll('-', '').slice(0, 7);
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

    expect(
      response.statusCode,
      `User registration failed: ${response.body}`,
    ).toBe(201);

    return response.json().data;
  }

  async function tokenFor(
    role: Role,
    userId?: string,
  ): Promise<string> {
    const user =
      userId === undefined
        ? await createUser(role === 'admin' ? 'faculty' : role)
        : { id: userId };

    return app.jwt.sign({
      sub: user.id,
      role,
    });
  }

  async function authHeaders(role: Role = 'faculty') {
    const token = await tokenFor(role);

    return {
      authorization: `Bearer ${token}`,
    };
  }

  async function createStudent(
    overrides: Partial<StudentInput> = {},
  ) {
    const id = uniqueId();

    const payload: StudentInput = {
      name: 'Test Student',
      email: `student.${crypto.randomUUID()}@example.com`,
      enrollmentNumber: `AI${id}`,
      department: 'AI-ML',
      semester: 5,
      ...overrides,
    };

    const response = await app.inject({
      method: 'POST',
      url: '/students',
      headers: await authHeaders('faculty'),
      payload,
    });

    expect(
      response.statusCode,
      `Student creation failed: ${response.body}`,
    ).toBe(201);

    return response.json().data;
  }

  async function linkStudent(
    studentId: string,
    userId: string,
    token?: string,
  ) {
    return app.inject({
      method: 'PATCH',
      url: `/students/${studentId}/link-user`,
      headers: token
        ? { authorization: `Bearer ${token}` }
        : {},
      payload: { userId },
    });
  }

  // --------------------------------------------------
  // Authentication and authorization
  // --------------------------------------------------

  it('rejects student creation without authentication', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/students',
      payload: {
        name: 'Test Student',
        email: 'unauthenticated@example.com',
        enrollmentNumber: `AI${uniqueId()}`,
        department: 'AI-ML',
        semester: 5,
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('allows faculty to create a student', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/students',
      headers: await authHeaders('faculty'),
      payload: {
        name: 'Faculty Created Student',
        email: `faculty-created.${crypto.randomUUID()}@example.com`,
        enrollmentNumber: `AI${uniqueId()}`,
        department: 'AI-ML',
        semester: 5,
      },
    });

    expect(response.statusCode).toBe(201);
  });

  it('rejects a student from listing all student records', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/students',
      headers: await authHeaders('student'),
    });

    expect(response.statusCode).toBe(403);
  });

  it('allows faculty to list students with pagination metadata', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/students?page=1&limit=5',
      headers: await authHeaders('faculty'),
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

  it('allows faculty to retrieve a student by ID', async () => {
    const student = await createStudent({
      name: 'Aman Kumar',
    });

    const response = await app.inject({
      method: 'GET',
      url: `/students/${student.id}`,
      headers: await authHeaders('faculty'),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.id).toBe(student.id);
  });

  it('allows faculty to update a student', async () => {
    const student = await createStudent();

    const response = await app.inject({
      method: 'PATCH',
      url: `/students/${student.id}`,
      headers: await authHeaders('faculty'),
      payload: {
        semester: 6,
        department: 'AI & ML',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.semester).toBe(6);
    expect(response.json().data.department).toBe('AI & ML');
  });

  it('rejects a student from updating records', async () => {
    const student = await createStudent();

    const response = await app.inject({
      method: 'PATCH',
      url: `/students/${student.id}`,
      headers: await authHeaders('student'),
      payload: { semester: 6 },
    });

    expect(response.statusCode).toBe(403);
  });

  it('allows an admin to delete a student', async () => {
    const student = await createStudent();

    const response = await app.inject({
      method: 'DELETE',
      url: `/students/${student.id}`,
      headers: await authHeaders('admin'),
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
  });

  it('rejects faculty from deleting a student', async () => {
    const student = await createStudent();

    const response = await app.inject({
      method: 'DELETE',
      url: `/students/${student.id}`,
      headers: await authHeaders('faculty'),
    });

    expect(response.statusCode).toBe(403);
  });

  // --------------------------------------------------
  // Student CRUD and validation
  // --------------------------------------------------

  it('creates a student successfully', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/students',
      headers: await authHeaders('faculty'),
      payload: {
        name: 'Rahul Sharma',
        email: `rahul.${crypto.randomUUID()}@example.com`,
        enrollmentNumber: `AI${uniqueId()}`,
        department: 'AI-ML',
        semester: 5,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().success).toBe(true);
    expect(response.json().data.name).toBe('Rahul Sharma');
  });

  it('rejects duplicate student email', async () => {
    const email = `duplicate.${crypto.randomUUID()}@example.com`;

    await createStudent({ email });

    const response = await app.inject({
      method: 'POST',
      url: '/students',
      headers: await authHeaders('faculty'),
      payload: {
        name: 'Second Student',
        email,
        enrollmentNumber: `AI${uniqueId()}`,
        department: 'AI-ML',
        semester: 5,
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('STUDENT_EMAIL_EXISTS');
  });

  it('rejects invalid student data', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/students',
      headers: await authHeaders('faculty'),
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

  it('trims student name, email, and department when creating', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/students',
      headers: await authHeaders('faculty'),
      payload: {
        name: '  Trimmed Student  ',
        email: `  trimmed.${crypto.randomUUID()}@example.com  `,
        enrollmentNumber: `AI${uniqueId()}`,
        department: '  CSE  ',
        semester: 5,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.name).toBe('Trimmed Student');
    expect(response.json().data.department).toBe('CSE');
  });

  it('rejects a student name longer than 100 characters', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/students',
      headers: await authHeaders('faculty'),
      payload: {
        name: 'A'.repeat(101),
        email: `long.${crypto.randomUUID()}@example.com`,
        enrollmentNumber: `AI${uniqueId()}`,
        department: 'CSE',
        semester: 5,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a student name shorter than 3 characters after trimming', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/students',
      headers: await authHeaders('faculty'),
      payload: {
        name: ' A ',
        email: `short.${crypto.randomUUID()}@example.com`,
        enrollmentNumber: `AI${uniqueId()}`,
        department: 'CSE',
        semester: 5,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an empty update payload', async () => {
    const student = await createStudent();

    const response = await app.inject({
      method: 'PATCH',
      url: `/students/${student.id}`,
      headers: await authHeaders('faculty'),
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects updating to an existing email', async () => {
    const first = await createStudent();
    const second = await createStudent();

    const response = await app.inject({
      method: 'PATCH',
      url: `/students/${second.id}`,
      headers: await authHeaders('faculty'),
      payload: { email: first.email },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('STUDENT_EMAIL_EXISTS');
  });

  it('rejects updating to an existing enrollment number', async () => {
    const first = await createStudent();
    const second = await createStudent();

    const response = await app.inject({
      method: 'PATCH',
      url: `/students/${second.id}`,
      headers: await authHeaders('faculty'),
      payload: { enrollmentNumber: first.enrollmentNumber },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('STUDENT_ENROLLMENT_EXISTS');
  });

  it('returns 404 when updating a non-existent student', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/students/00000000-0000-4000-8000-000000000001',
      headers: await authHeaders('faculty'),
      payload: { semester: 6 },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('STUDENT_NOT_FOUND');
  });

  it('returns 404 when deleting a non-existent student', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/students/00000000-0000-4000-8000-000000000001',
      headers: await authHeaders('admin'),
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('STUDENT_NOT_FOUND');
  });

  it('returns 404 when a student does not exist', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/students/00000000-0000-4000-8000-000000000001',
      headers: await authHeaders('faculty'),
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('STUDENT_NOT_FOUND');
  });

  it('searches students by name', async () => {
    const name = `SearchStudent${uniqueId()}`;

    await createStudent({ name });

    const response = await app.inject({
      method: 'GET',
      url: `/students?search=${encodeURIComponent(name)}`,
      headers: await authHeaders('faculty'),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.students).toHaveLength(1);
    expect(response.json().data.students[0].name).toBe(name);
  });

  it('rejects an invalid page number', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/students?page=0',
      headers: await authHeaders('faculty'),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a limit greater than 100', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/students?limit=101',
      headers: await authHeaders('faculty'),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a zero pagination limit', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/students?limit=0',
      headers: await authHeaders('faculty'),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an invalid email when updating a student', async () => {
    const student = await createStudent();

    const response = await app.inject({
      method: 'PATCH',
      url: `/students/${student.id}`,
      headers: await authHeaders('faculty'),
      payload: { email: 'invalid-email' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  // --------------------------------------------------
  // Student account linking
  // --------------------------------------------------

  it('links a student record to a student account', async () => {
    const student = await createStudent();
    const user = await createUser('student');
    const token = await tokenFor('faculty');

    const response = await linkStudent(student.id, user.id, token);

    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);
    expect(response.json().data.id).toBe(student.id);
    expect(response.json().data.userId).toBe(user.id);
  });

  it('requires authentication to link a student account', async () => {
    const student = await createStudent();
    const user = await createUser('student');

    const response = await linkStudent(student.id, user.id);

    expect(response.statusCode).toBe(401);
  });

  it('rejects a student token when linking an account', async () => {
    const student = await createStudent();
    const user = await createUser('student');
    const token = await tokenFor('student');

    const response = await linkStudent(student.id, user.id, token);

    expect(response.statusCode).toBe(403);
  });

  it('returns 404 when linking a non-existent student', async () => {
    const user = await createUser('student');
    const token = await tokenFor('faculty');

    const response = await linkStudent(
      '00000000-0000-4000-8000-000000000001',
      user.id,
      token,
    );

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('STUDENT_NOT_FOUND');
  });

  it('returns 404 when linking a non-existent user', async () => {
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

  it('rejects linking a faculty account to a student record', async () => {
    const student = await createStudent();
    const faculty = await createUser('faculty');
    const token = await tokenFor('faculty');

    const response = await linkStudent(student.id, faculty.id, token);

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('INVALID_USER_ROLE');
  });

  it('rejects linking a student that already has an account', async () => {
    const student = await createStudent();
    const firstUser = await createUser('student');
    const secondUser = await createUser('student');
    const token = await tokenFor('faculty');

    const firstResponse = await linkStudent(
      student.id,
      firstUser.id,
      token,
    );

    expect(firstResponse.statusCode).toBe(200);

    const secondResponse = await linkStudent(
      student.id,
      secondUser.id,
      token,
    );

    expect(secondResponse.statusCode).toBe(409);
    expect(secondResponse.json().error.code).toBe('STUDENT_ALREADY_LINKED');
  });

  it('rejects linking a user already linked to another student', async () => {
    const firstStudent = await createStudent();
    const secondStudent = await createStudent();
    const user = await createUser('student');
    const token = await tokenFor('faculty');

    const firstResponse = await linkStudent(
      firstStudent.id,
      user.id,
      token,
    );

    expect(firstResponse.statusCode).toBe(200);

    const secondResponse = await linkStudent(
      secondStudent.id,
      user.id,
      token,
    );

    expect(secondResponse.statusCode).toBe(409);
    expect(secondResponse.json().error.code).toBe('USER_ALREADY_LINKED');
  });

  it('rejects an invalid user ID when linking', async () => {
    const student = await createStudent();
    const token = await tokenFor('faculty');

    const response = await linkStudent(
      student.id,
      'not-a-valid-uuid',
      token,
    );

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('allows a student to retrieve their own linked record', async () => {
    const student = await createStudent();
    const user = await createUser('student');
    const token = await tokenFor('student', user.id);

    const linkResponse = await linkStudent(
      student.id,
      user.id,
      await tokenFor('faculty'),
    );

    expect(linkResponse.statusCode).toBe(200);

    const response = await app.inject({
      method: 'GET',
      url: `/students/${student.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.id).toBe(student.id);
  });

  it('prevents a student from retrieving another student record', async () => {
    const firstStudent = await createStudent();
    const secondStudent = await createStudent();
    const user = await createUser('student');

    await linkStudent(
      firstStudent.id,
      user.id,
      await tokenFor('faculty'),
    );

    const token = await tokenFor('student', user.id);

    const response = await app.inject({
      method: 'GET',
      url: `/students/${secondStudent.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it('returns forbidden when a student account is not linked', async () => {
    const student = await createStudent();
    const user = await createUser('student');
    const token = await tokenFor('student', user.id);

    const response = await app.inject({
      method: 'GET',
      url: `/students/${student.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);
  });
});