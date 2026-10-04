import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';

describe('Student API', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
  });

  afterEach(async () => {
    await app.close();
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
    expect(body.data.pagination).toEqual({
      page: 1,
      limit: 5,
      total: body.data.pagination.total,
      totalPages: body.data.pagination.totalPages,
    });
  });
  it('should search students by name', async () => {
    await app.inject({
      method: 'POST',
      url: '/students',
      payload: {
        name: 'Aman Kumar',
        email: 'aman.search@example.com',
        enrollmentNumber: 'AI2026010',
        department: 'AI-ML',
        semester: 5,
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/students?search=Aman',
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.data.students.length).toBe(1);
    expect(body.data.students[0].name).toBe('Aman Kumar');
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
    const createResponse = await app.inject({
      method: 'POST',
      url: '/students',
      payload: {
        name: 'Aman Kumar',
        email: 'aman@example.com',
        enrollmentNumber: 'AI2026003',
        department: 'AI-ML',
        semester: 5,
      },
    });

    const studentId = createResponse.json().data.id;

    const response = await app.inject({
      method: 'GET',
      url: `/students/${studentId}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);
    expect(response.json().data.id).toBe(studentId);
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
});
