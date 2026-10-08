import { beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';

import { buildApp } from '../src/app.js';
import { createTestContainer } from '../src/test-container.js';

describe('Submission Routes', () => {
  const app = buildApp(createTestContainer());

  let studentId: string;
  let otherStudentId: string;
  let courseId: string;
  let assignmentId: string;

  let studentToken: string;
  let otherStudentToken: string;
  let facultyToken: string;
  let adminToken: string;

  let studentHeaders: { authorization: string };
  let otherStudentHeaders: { authorization: string };
  let facultyHeaders: { authorization: string };
  let adminHeaders: { authorization: string };

  beforeEach(async () => {
    await app.ready();

    studentToken = app.jwt.sign({
      sub: 'student-test-id',
      role: 'student',
    });

    otherStudentToken = app.jwt.sign({
      sub: 'other-student-test-id',
      role: 'student',
    });

    facultyToken = app.jwt.sign({
      sub: 'faculty-test-id',
      role: 'faculty',
    });

    adminToken = app.jwt.sign({
      sub: 'admin-test-id',
      role: 'admin',
    });

    studentHeaders = {
      authorization: `Bearer ${studentToken}`,
    };

    otherStudentHeaders = {
      authorization: `Bearer ${otherStudentToken}`,
    };

    facultyHeaders = {
      authorization: `Bearer ${facultyToken}`,
    };

    adminHeaders = {
      authorization: `Bearer ${adminToken}`,
    };

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

    const otherStudentResponse = await app.inject({
      method: 'POST',
      url: '/students',
      payload: {
        name: 'Other Student',
        email: `other-${randomUUID()}@example.com`,
        enrollmentNumber: `EN${randomUUID().replaceAll('-', '').slice(0, 8)}`,
        department: 'Computer Science',
        semester: 5,
      },
    });

    otherStudentId = otherStudentResponse.json().data.id;

    // JWT sub values must match the students used in ownership tests.
    studentToken = app.jwt.sign({
      sub: studentId,
      role: 'student',
    });

    otherStudentToken = app.jwt.sign({
      sub: otherStudentId,
      role: 'student',
    });

    studentHeaders = {
      authorization: `Bearer ${studentToken}`,
    };

    otherStudentHeaders = {
      authorization: `Bearer ${otherStudentToken}`,
    };

    const courseResponse = await app.inject({
      method: 'POST',
      url: '/courses',
      headers: facultyHeaders,
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
      headers: facultyHeaders,
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

  it('should reject unauthenticated submission creation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/submissions',
      payload: {
        studentId,
        assignmentId,
        content: 'My completed assignment solution',
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should create a submission', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/submissions',
      headers: studentHeaders,
      payload: {
        studentId,
        assignmentId,
        content: 'My completed assignment solution',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.status).toBe('submitted');
  });

  it('should reject faculty from creating a submission', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/submissions',
      headers: facultyHeaders,
      payload: {
        studentId,
        assignmentId,
        content: 'Faculty should not submit this',
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('should reject a student from submitting for another student', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/submissions',
      headers: studentHeaders,
      payload: {
        studentId: otherStudentId,
        assignmentId,
        content: 'Trying to submit for another student',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
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
      headers: studentHeaders,
      payload,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/submissions',
      headers: studentHeaders,
      payload,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('SUBMISSION_EXISTS');
  });

  it('should reject submission from nonexistent student', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/submissions',
      headers: studentHeaders,
      payload: {
        studentId,
        assignmentId: randomUUID(),
        content: 'My completed assignment solution',
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it('should reject submission for nonexistent assignment', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/submissions',
      headers: studentHeaders,
      payload: {
        studentId,
        assignmentId: randomUUID(),
        content: 'My completed assignment solution',
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('ASSIGNMENT_NOT_FOUND');
  });

  it('should retrieve own student submissions', async () => {
    await app.inject({
      method: 'POST',
      url: '/submissions',
      headers: studentHeaders,
      payload: {
        studentId,
        assignmentId,
        content: 'My completed assignment solution',
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: `/submissions/student/${studentId}`,
      headers: studentHeaders,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toHaveLength(1);
  });

  it('should reject a student from viewing another student submissions', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/submissions/student/${otherStudentId}`,
      headers: studentHeaders,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
  });

  it('should allow faculty to view student submissions', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/submissions/student/${studentId}`,
      headers: facultyHeaders,
    });

    expect(response.statusCode).toBe(200);
  });

  it('should update own submission content', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/submissions',
      headers: studentHeaders,
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
      headers: studentHeaders,
      payload: {
        content: 'My updated assignment solution',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.content).toBe(
      'My updated assignment solution',
    );
  });

  it('should reject another student from updating the submission', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/submissions',
      headers: studentHeaders,
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
      headers: otherStudentHeaders,
      payload: {
        content: 'Trying to modify another submission',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
  });

  it('should reject faculty from updating submission content', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/submissions',
      headers: studentHeaders,
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
      headers: facultyHeaders,
      payload: {
        content: 'Faculty should use grading endpoint',
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('should allow faculty to grade a submission', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/submissions',
      headers: studentHeaders,
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
      headers: facultyHeaders,
      payload: {
        marks: 85,
        feedback: 'Good work',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.status).toBe('graded');
    expect(response.json().data.marks).toBe(85);
  });

  it('should allow admin to grade a submission', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/submissions',
      headers: studentHeaders,
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
      headers: adminHeaders,
      payload: {
        marks: 90,
        feedback: 'Admin grading',
      },
    });

    expect(response.statusCode).toBe(200);
  });

  it('should reject a student from grading a submission', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/submissions',
      headers: studentHeaders,
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
      headers: studentHeaders,
      payload: {
        marks: 85,
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('should reject marks exceeding maximum marks', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/submissions',
      headers: studentHeaders,
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
      headers: facultyHeaders,
      payload: {
        marks: 150,
        feedback: 'Invalid marks',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('INVALID_MARKS');
  });

  it('should allow faculty to view assignment submissions', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/submissions/assignment/${assignmentId}`,
      headers: facultyHeaders,
    });

    expect(response.statusCode).toBe(200);
  });

  it('should reject a student from viewing assignment submissions', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/submissions/assignment/${assignmentId}`,
      headers: studentHeaders,
    });

    expect(response.statusCode).toBe(403);
  });

  it('should retrieve a submission by ID for faculty', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/submissions',
      headers: studentHeaders,
      payload: {
        studentId,
        assignmentId,
        content: 'My completed assignment solution',
      },
    });

    const submissionId = createResponse.json().data.id;

    const response = await app.inject({
      method: 'GET',
      url: `/submissions/${submissionId}`,
      headers: facultyHeaders,
    });

    expect(response.statusCode).toBe(200);
  });

  it('should reject a student from viewing another student submission', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/submissions',
      headers: studentHeaders,
      payload: {
        studentId,
        assignmentId,
        content: 'My completed assignment solution',
      },
    });

    const submissionId = createResponse.json().data.id;

    const response = await app.inject({
      method: 'GET',
      url: `/submissions/${submissionId}`,
      headers: otherStudentHeaders,
    });

    expect(response.statusCode).toBe(403);
  });

  it('should return 404 for nonexistent submission', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/submissions/${randomUUID()}`,
      headers: facultyHeaders,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('SUBMISSION_NOT_FOUND');
  });
});