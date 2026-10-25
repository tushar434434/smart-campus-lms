import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { createTestContainer } from '../src/test-container.js';

describe('Enrollment API', () => {
  let app: ReturnType<typeof buildApp>;
  let studentId: string;
  let courseId: string;
  let facultyToken: string;
  let adminToken: string;

  const facultyHeaders = () => ({
    authorization: `Bearer ${facultyToken}`,
  });

  const adminHeaders = () => ({
    authorization: `Bearer ${adminToken}`,
  });

  beforeEach(async () => {
    app = buildApp(createTestContainer());
    await app.ready();

    facultyToken = app.jwt.sign({
      sub: randomUUID(),
      role: 'faculty',
    });

    adminToken = app.jwt.sign({
      sub: randomUUID(),
      role: 'admin',
    });

    const studentResponse = await app.inject({
      method: 'POST',
      url: '/students',
      headers: facultyHeaders(),
      payload: {
        name: 'Tushar Kumar',
        email: `tushar.${randomUUID()}@example.com`,
        enrollmentNumber: `ENR${randomUUID().replaceAll('-', '').slice(0, 10)}`,
        department: 'AI-ML',
        semester: 5,
      },
    });

    expect(
      studentResponse.statusCode,
      `Student setup failed: ${studentResponse.body}`,
    ).toBe(201);

    studentId = studentResponse.json().data.id;

    const courseResponse = await app.inject({
      method: 'POST',
      url: '/courses',
      headers: facultyHeaders(),
      payload: {
        title: 'Operating Systems',
        code: 'CS501',
        credits: 4,
      },
    });

    expect(
      courseResponse.statusCode,
      `Course setup failed: ${courseResponse.body}`,
    ).toBe(201);

    courseId = courseResponse.json().data.id;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Authentication and authorization', () => {
    it('should reject enrollment creation without a token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/enrollments',
        payload: { studentId, courseId },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject enrollment creation for students', async () => {
      const studentToken = app.jwt.sign({
        sub: randomUUID(),
        role: 'student',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: {
          authorization: `Bearer ${studentToken}`,
        },
        payload: { studentId, courseId },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should reject enrollment retrieval without a token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/enrollments/student/${studentId}`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject enrollment retrieval for students', async () => {
      const studentToken = app.jwt.sign({
        sub: randomUUID(),
        role: 'student',
      });

      const response = await app.inject({
        method: 'GET',
        url: `/enrollments/student/${studentId}`,
        headers: {
          authorization: `Bearer ${studentToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should reject enrollment deletion without a token', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/enrollments/${randomUUID()}`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject enrollment deletion for students', async () => {
      const studentToken = app.jwt.sign({
        sub: randomUUID(),
        role: 'student',
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/enrollments/${randomUUID()}`,
        headers: {
          authorization: `Bearer ${studentToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Create enrollment', () => {
    it('should enroll a student successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: facultyHeaders(),
        payload: { studentId, courseId },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().success).toBe(true);
      expect(response.json().data).toMatchObject({
        studentId,
        courseId,
      });
    });

    it('should allow an admin to enroll a student', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: adminHeaders(),
        payload: { studentId, courseId },
      });

      expect(response.statusCode).toBe(201);
    });

    it('should prevent duplicate enrollment', async () => {
      const payload = { studentId, courseId };

      const firstResponse = await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: facultyHeaders(),
        payload,
      });

      expect(firstResponse.statusCode).toBe(201);

      const response = await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: facultyHeaders(),
        payload,
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('ENROLLMENT_EXISTS');
    });

    it('should reject enrollment for a nonexistent student', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: facultyHeaders(),
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
        headers: facultyHeaders(),
        payload: {
          studentId,
          courseId: randomUUID(),
        },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('COURSE_NOT_FOUND');
    });
  });

  describe('Get student enrollments', () => {
    it('should retrieve student enrollments', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: facultyHeaders(),
        payload: { studentId, courseId },
      });

      expect(createResponse.statusCode).toBe(201);

      const response = await app.inject({
        method: 'GET',
        url: `/enrollments/student/${studentId}`,
        headers: facultyHeaders(),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().success).toBe(true);
      expect(response.json().data).toHaveLength(1);
      expect(response.json().data[0]).toMatchObject({
        studentId,
        courseId,
      });
    });

    it('should allow an admin to retrieve student enrollments', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/enrollments/student/${studentId}`,
        headers: adminHeaders(),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().success).toBe(true);
    });
  });

  describe('Delete enrollment', () => {
    it('should delete an enrollment successfully', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: facultyHeaders(),
        payload: { studentId, courseId },
      });

      expect(createResponse.statusCode).toBe(201);

      const enrollmentId = createResponse.json().data.id;

      const response = await app.inject({
        method: 'DELETE',
        url: `/enrollments/${enrollmentId}`,
        headers: adminHeaders(),
      });

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('');
    });

    it('should allow an admin to delete an enrollment', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: facultyHeaders(),
        payload: { studentId, courseId },
      });

      expect(createResponse.statusCode).toBe(201);

      const response = await app.inject({
        method: 'DELETE',
        url: `/enrollments/${createResponse.json().data.id}`,
        headers: adminHeaders(),
      });

      expect(response.statusCode).toBe(204);
    });

    it('should return 404 when deleting a nonexistent enrollment', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/enrollments/${randomUUID()}`,
        headers: adminHeaders(),
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('ENROLLMENT_NOT_FOUND');
    });
  });
});
