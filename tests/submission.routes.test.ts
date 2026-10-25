import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { createTestContainer } from '../src/test-container.js';

type Headers = { authorization: string };
type TestStudent = { id: string };
type TestUser = { id: string };
type TestSubmission = {
  id: string;
  status: string;
  content?: string;
  marks?: number;
};

describe('Submission Routes', () => {
  let app: ReturnType<typeof buildApp>;

  let studentId: string;
  let otherStudentId: string;
  let courseId: string;
  let assignmentId: string;

  let studentHeaders: Headers;
  let otherStudentHeaders: Headers;
  let facultyHeaders: Headers;
  let adminHeaders: Headers;

  async function createStudentRecord(name: string): Promise<TestStudent> {
    const response = await app.inject({
      method: 'POST',
      url: '/students',
      headers: facultyHeaders,
      payload: {
        name,
        email: `${name.toLowerCase().replaceAll(' ', '.')}-${randomUUID()}@example.com`,
        enrollmentNumber: `EN${randomUUID().replaceAll('-', '').slice(0, 8)}`,
        department: 'Computer Science',
        semester: 5,
      },
    });

    expect(response.statusCode, `Create student failed: ${response.body}`).toBe(
      201,
    );

    return response.json().data as TestStudent;
  }

  async function createStudentUser(name: string): Promise<TestUser> {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        name,
        email: `${name.toLowerCase().replaceAll(' ', '.')}-${randomUUID()}@example.com`,
        password: 'TestPassword123!',
        role: 'student',
      },
    });

    expect(
      response.statusCode,
      `Register student user failed: ${response.body}`,
    ).toBe(201);

    return response.json().data as TestUser;
  }

  async function linkStudentToUser(
    studentRecordId: string,
    userId: string,
  ): Promise<void> {
    const response = await app.inject({
      method: 'PATCH',
      url: `/students/${studentRecordId}/link-user`,
      headers: facultyHeaders,
      payload: { userId },
    });

    expect(
      response.statusCode,
      `Link student user failed: ${response.body}`,
    ).toBe(200);
  }

  async function createSubmission(
    headers: Headers = studentHeaders,
    content = 'My completed assignment solution',
    targetStudentId = studentId,
  ): Promise<TestSubmission> {
    const response = await app.inject({
      method: 'POST',
      url: '/submissions',
      headers,
      payload: {
        studentId: targetStudentId,
        assignmentId,
        content,
      },
    });

    expect(
      response.statusCode,
      `Create submission failed: ${response.body}`,
    ).toBe(201);

    return response.json().data as TestSubmission;
  }

  beforeEach(async () => {
    app = buildApp(createTestContainer());
    await app.ready();

    facultyHeaders = {
      authorization: `Bearer ${app.jwt.sign({
        sub: randomUUID(),
        role: 'faculty',
      })}`,
    };

    adminHeaders = {
      authorization: `Bearer ${app.jwt.sign({
        sub: randomUUID(),
        role: 'admin',
      })}`,
    };

    // Create student records using an authorized faculty request.
    const studentRecord = await createStudentRecord('Test Student');
    const otherStudentRecord = await createStudentRecord('Other Student');

    studentId = studentRecord.id;
    otherStudentId = otherStudentRecord.id;

    // Create actual user accounts.
    const studentUser = await createStudentUser('Test Student User');
    const otherStudentUser = await createStudentUser('Other Student User');

    // Link each user account to its corresponding student record.
    await linkStudentToUser(studentId, studentUser.id);
    await linkStudentToUser(otherStudentId, otherStudentUser.id);

    // JWT sub must be User.id, not Student.id.
    studentHeaders = {
      authorization: `Bearer ${app.jwt.sign({
        sub: studentUser.id,
        role: 'student',
      })}`,
    };

    otherStudentHeaders = {
      authorization: `Bearer ${app.jwt.sign({
        sub: otherStudentUser.id,
        role: 'student',
      })}`,
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

    expect(
      courseResponse.statusCode,
      `Create course failed: ${courseResponse.body}`,
    ).toBe(201);

    courseId = courseResponse.json().data.id as string;

    const assignmentResponse = await app.inject({
      method: 'POST',
      url: '/assignments',
      headers: facultyHeaders,
      payload: {
        courseId,
        title: 'Array Assignment',
        description: 'Solve array problems',
        dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        maxMarks: 100,
      },
    });

    expect(
      assignmentResponse.statusCode,
      `Create assignment failed: ${assignmentResponse.body}`,
    ).toBe(201);

    assignmentId = assignmentResponse.json().data.id as string;
  });

  afterEach(async () => {
    await app.close();
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
    const submission = await createSubmission();

    expect(submission.status).toBe('submitted');
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

    const firstResponse = await app.inject({
      method: 'POST',
      url: '/submissions',
      headers: studentHeaders,
      payload,
    });

    expect(firstResponse.statusCode, firstResponse.body).toBe(201);

    const response = await app.inject({
      method: 'POST',
      url: '/submissions',
      headers: studentHeaders,
      payload,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('SUBMISSION_EXISTS');
  });

  it('should reject a student from submitting for a nonexistent student record', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/submissions',
      headers: studentHeaders,
      payload: {
        studentId: randomUUID(),
        assignmentId,
        content: 'Trying to submit for a nonexistent student',
      },
    });

    // Ownership is checked before record existence.
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
  });

  it('should reject submission for a nonexistent assignment', async () => {
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
    await createSubmission();

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
    const submission = await createSubmission(
      studentHeaders,
      'My original assignment solution',
    );

    const response = await app.inject({
      method: 'PATCH',
      url: `/submissions/${submission.id}`,
      headers: studentHeaders,
      payload: {
        content: 'My updated assignment solution',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.content).toBe('My updated assignment solution');
  });

  it('should reject another student from updating the submission', async () => {
    const submission = await createSubmission(
      studentHeaders,
      'My original assignment solution',
    );

    const response = await app.inject({
      method: 'PATCH',
      url: `/submissions/${submission.id}`,
      headers: otherStudentHeaders,
      payload: {
        content: 'Trying to modify another submission',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
  });

  it('should reject faculty from updating submission content', async () => {
    const submission = await createSubmission(
      studentHeaders,
      'My original assignment solution',
    );

    const response = await app.inject({
      method: 'PATCH',
      url: `/submissions/${submission.id}`,
      headers: facultyHeaders,
      payload: {
        content: 'Faculty should use grading endpoint',
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('should allow faculty to grade a submission', async () => {
    const submission = await createSubmission();

    const response = await app.inject({
      method: 'PATCH',
      url: `/submissions/${submission.id}/grade`,
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
    const submission = await createSubmission();

    const response = await app.inject({
      method: 'PATCH',
      url: `/submissions/${submission.id}/grade`,
      headers: adminHeaders,
      payload: {
        marks: 90,
        feedback: 'Admin grading',
      },
    });

    expect(response.statusCode).toBe(200);
  });

  it('should reject a student from grading a submission', async () => {
    const submission = await createSubmission();

    const response = await app.inject({
      method: 'PATCH',
      url: `/submissions/${submission.id}/grade`,
      headers: studentHeaders,
      payload: {
        marks: 85,
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('should reject marks exceeding maximum marks', async () => {
    const submission = await createSubmission();

    const response = await app.inject({
      method: 'PATCH',
      url: `/submissions/${submission.id}/grade`,
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
    const submission = await createSubmission();

    const response = await app.inject({
      method: 'GET',
      url: `/submissions/${submission.id}`,
      headers: facultyHeaders,
    });

    expect(response.statusCode).toBe(200);
  });

  it('should reject a student from viewing another student submission', async () => {
    const submission = await createSubmission();

    const response = await app.inject({
      method: 'GET',
      url: `/submissions/${submission.id}`,
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

