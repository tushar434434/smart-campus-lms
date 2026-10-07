import { beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';

import { buildApp } from '../src/app.js';
import { createTestContainer } from '../src/test-container.js';

describe('Submission Routes', () => {
  const app = buildApp(createTestContainer());

  let studentId: string;
  let courseId: string;
  let assignmentId: string;
  let facultyToken: string;

  beforeEach(async () => {
    await app.ready();

    facultyToken = app.jwt.sign({
      sub: 'faculty-test-id',
      role: 'faculty',
    });

    const studentResponse = await app.inject({
      method: 'POST',
      url: '/students',
      payload: {
        name: 'Test Student',
        email: `student-${randomUUID()}@example.com`,
        enrollmentNumber: `EN${randomUUID().replaceAll('-', '').slice(0, 8)}`,
        department: 'Computer Science',
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
        title: 'Data Structures',
        code: `CS${Math.floor(1000 + Math.random() * 9000)}`,
        credits: 4,
      },
    });

    courseId = courseResponse.json().data.id;

    const assignmentResponse = await app.inject({
      method: 'POST',
      url: '/assignments',
      headers: {
        authorization: `Bearer ${facultyToken}`,
      },
      payload: {
        courseId,
        title: 'Array Assignment',
        description: 'Solve array problems',
        dueAt: '2026-10-20T18:00:00.000Z',
        maxMarks: 100,
      },
    });

    assignmentId = assignmentResponse.json().data.id;
  });

  it('should create a submission', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/submissions',
      payload: {
        studentId,
        assignmentId,
        content: 'My completed assignment solution',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.status).toBe('submitted');
  });

  it('should reject duplicate submissions', async () => {
    const payload = {
      studentId,
      assignmentId,
      content: 'My completed assignment solution',
    };

    await app.inject({
      method: 'POST',
      url: '/submissions',
      payload,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/submissions',
      payload,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('SUBMISSION_EXISTS');
  });

  it('should reject submission from nonexistent student', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/submissions',
      payload: {
        studentId: randomUUID(),
        assignmentId,
        content: 'My completed assignment solution',
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('STUDENT_NOT_FOUND');
  });

  it('should reject submission for nonexistent assignment', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/submissions',
      payload: {
        studentId,
        assignmentId: randomUUID(),
        content: 'My completed assignment solution',
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('ASSIGNMENT_NOT_FOUND');
  });

  it('should retrieve student submissions', async () => {
    await app.inject({
      method: 'POST',
      url: '/submissions',
      payload: {
        studentId,
        assignmentId,
        content: 'My completed assignment solution',
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: `/submissions/student/${studentId}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toHaveLength(1);
  });

  it('should update submission content', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/submissions',
      payload: {
        studentId,
        assignmentId,
        content: 'My original assignment solution',
      },
    });

    const submissionId = createResponse.json().data.id;

    const response = await app.inject({
      method: 'PATCH',
      url: `/submissions/${submissionId}`,
      payload: {
        content: 'My updated assignment solution',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.content).toBe('My updated assignment solution');
  });

  it('should grade a submission', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/submissions',
      payload: {
        studentId,
        assignmentId,
        content: 'My completed assignment solution',
      },
    });

    const submissionId = createResponse.json().data.id;

    const response = await app.inject({
      method: 'PATCH',
      url: `/submissions/${submissionId}/grade`,
      payload: {
        marks: 85,
        feedback: 'Good work',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.status).toBe('graded');
    expect(response.json().data.marks).toBe(85);
  });

  it('should reject marks exceeding maximum marks', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/submissions',
      payload: {
        studentId,
        assignmentId,
        content: 'My completed assignment solution',
      },
    });

    const submissionId = createResponse.json().data.id;

    const response = await app.inject({
      method: 'PATCH',
      url: `/submissions/${submissionId}/grade`,
      payload: {
        marks: 150,
        feedback: 'Invalid marks',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('INVALID_MARKS');
  });

  it('should return 404 for nonexistent submission', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/submissions/${randomUUID()}`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('SUBMISSION_NOT_FOUND');
  });
});
