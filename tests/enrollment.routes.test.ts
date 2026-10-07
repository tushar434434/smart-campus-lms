import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createTestContainer } from '../src/test-container.js';
describe('Enrollment API', () => {
  let app: ReturnType<typeof buildApp>;
  let studentId: string;
  let courseId: string;
  let facultyToken: string;

  beforeEach(async () => {
    app = buildApp(createTestContainer());
    await app.ready();

    facultyToken = app.jwt.sign({
      sub: 'faculty-test-id',
      role: 'faculty',
    });

    const studentResponse = await app.inject({
      method: 'POST',
      url: '/students',
      payload: {
        name: 'Tushar Kumar',
        email: 'tushar.enrollment@example.com',
        enrollmentNumber: 'ENR2026001',
        department: 'AI-ML',
        semester: 5,
      },
    });

    studentId = studentResponse.json().data.id;

    const courseResponse = await app.inject({
      method: 'POST',
      url: '/courses',
      headers: {
        authorization: `Bearer ${facultyToken}`,
      },
      payload: {
        title: 'Operating Systems',
        code: 'CS301',
        credits: 4,
      },
    });

    courseId = courseResponse.json().data.id;
  });

  afterEach(async () => {
    await app.close();
  });

  it('should enroll a student successfully', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/enrollments',
      payload: { studentId, courseId },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().success).toBe(true);
    expect(response.json().data).toMatchObject({
      studentId,
      courseId,
    });
  });

  it('should prevent duplicate enrollment', async () => {
    const payload = { studentId, courseId };

    await app.inject({
      method: 'POST',
      url: '/enrollments',
      payload,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/enrollments',
      payload,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('ENROLLMENT_EXISTS');
  });

  it('should reject enrollment for a nonexistent student', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/enrollments',
      payload: {
        studentId: randomUUID(),
        courseId,
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('STUDENT_NOT_FOUND');
  });

  it('should reject enrollment for a nonexistent course', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/enrollments',
      payload: {
        studentId,
        courseId: randomUUID(),
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('COURSE_NOT_FOUND');
  });

  it('should retrieve student enrollments', async () => {
    await app.inject({
      method: 'POST',
      url: '/enrollments',
      payload: { studentId, courseId },
    });

    const response = await app.inject({
      method: 'GET',
      url: `/enrollments/student/${studentId}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);
    expect(response.json().data).toHaveLength(1);
    expect(response.json().data[0]).toMatchObject({
      studentId,
      courseId,
    });
  });

  it('should delete an enrollment successfully', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/enrollments',
      payload: { studentId, courseId },
    });

    const enrollmentId = createResponse.json().data.id;

    const response = await app.inject({
      method: 'DELETE',
      url: `/enrollments/${enrollmentId}`,
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
  });

  it('should return 404 when deleting a nonexistent enrollment', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: `/enrollments/${randomUUID()}`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('ENROLLMENT_NOT_FOUND');
  });
});
