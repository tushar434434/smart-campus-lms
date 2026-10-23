
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createTestContainer } from '../src/test-container.js';

describe('Quiz Routes', () => {
  let app: ReturnType<typeof buildApp>;
  let courseId: string;
  let facultyToken: string;
  let adminToken: string;
  let studentToken: string;

  const validQuiz = () => ({
    courseId,
    title: 'Data Structures Quiz',
    description: 'Assessment covering arrays and linked lists',
    durationMinutes: 30,
    maxMarks: 20,
    maxAttempts: 2,
  });

  beforeEach(async () => {
    app = buildApp(createTestContainer());
    await app.ready();

    facultyToken = app.jwt.sign({
      sub: 'faculty-test-id',
      role: 'faculty',
    });

    adminToken = app.jwt.sign({
      sub: 'admin-test-id',
      role: 'admin',
    });

    studentToken = app.jwt.sign({
      sub: 'student-test-id',
      role: 'student',
    });

    const courseResponse = await app.inject({
      method: 'POST',
      url: '/courses',
      headers: {
        authorization: `Bearer ${facultyToken}`,
      },
      payload: {
        title: 'Data Structures',
        code: `CS${Math.floor(Math.random() * 9000) + 1000}`,
        credits: 4,
      },
    });

    expect(courseResponse.statusCode).toBe(201);
    courseId = courseResponse.json().data.id;
  });

  afterEach(async () => {
    await app.close();
  });

  it('should reject publishing a draft quiz without questions', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/quizzes',
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: validQuiz(),
    });

    expect(created.statusCode).toBe(201);

    const quizId = created.json().data.id;

    const response = await app.inject({
      method: 'POST',
      url: `/quizzes/${quizId}/publish`,
      headers: { authorization: `Bearer ${facultyToken}` },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('QUIZ_HAS_NO_QUESTIONS');

    const quizResponse = await app.inject({
      method: 'GET',
      url: `/quizzes/${quizId}`,
      headers: { authorization: `Bearer ${facultyToken}` },
    });

    expect(quizResponse.statusCode).toBe(200);
    expect(quizResponse.json().data.status).toBe('draft');
  });

  it('should reject publishing a quiz without questions', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/quizzes',
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: validQuiz(),
    });

    expect(created.statusCode).toBe(201);

    const response = await app.inject({
      method: 'POST',
      url: `/quizzes/${created.json().data.id}/publish`,
      headers: { authorization: `Bearer ${facultyToken}` },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('QUIZ_HAS_NO_QUESTIONS');
  });

  it('should reject quiz publishing by a student', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/quizzes',
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: validQuiz(),
    });

    const response = await app.inject({
      method: 'POST',
      url: `/quizzes/${created.json().data.id}/publish`,
      headers: { authorization: `Bearer ${studentToken}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it('should return 404 when publishing a nonexistent quiz', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/quizzes/${randomUUID()}/publish`,
      headers: { authorization: `Bearer ${facultyToken}` },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('QUIZ_NOT_FOUND');
  });

  it('should create a quiz', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/quizzes',
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: validQuiz(),
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.title).toBe('Data Structures Quiz');
  });

  it('should reject quiz creation without authentication', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/quizzes',
      payload: validQuiz(),
    });

    expect(response.statusCode).toBe(401);
  });

  it('should reject quiz creation by a student', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/quizzes',
      headers: { authorization: `Bearer ${studentToken}` },
      payload: validQuiz(),
    });

    expect(response.statusCode).toBe(403);
  });

  it('should reject invalid quiz input', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/quizzes',
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: {
        ...validQuiz(),
        title: 'A',
        durationMinutes: -1,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject a quiz for a nonexistent course', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/quizzes',
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: { ...validQuiz(), courseId: randomUUID() },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('COURSE_NOT_FOUND');
  });

  it('should retrieve a quiz by ID', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/quizzes',
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: validQuiz(),
    });

    const id = created.json().data.id;

    const response = await app.inject({
      method: 'GET',
      url: `/quizzes/${id}`,
      headers: { authorization: `Bearer ${facultyToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.id).toBe(id);
  });

  it('should reject retrieval without authentication', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/quizzes/${randomUUID()}`,
    });

    expect(response.statusCode).toBe(401);
  });

  it('should return 404 for a nonexistent quiz', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/quizzes/${randomUUID()}`,
      headers: { authorization: `Bearer ${facultyToken}` },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('QUIZ_NOT_FOUND');
  });

  it('should list quizzes for a course', async () => {
    await app.inject({
      method: 'POST',
      url: '/quizzes',
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: validQuiz(),
    });

    const response = await app.inject({
      method: 'GET',
      url: `/courses/${courseId}/quizzes`,
      headers: { authorization: `Bearer ${facultyToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toHaveLength(1);
  });

  it('should reject an invalid course ID', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/courses/not-a-uuid/quizzes',
      headers: { authorization: `Bearer ${facultyToken}` },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should update a quiz', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/quizzes',
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: validQuiz(),
    });

    const id = created.json().data.id;

    const response = await app.inject({
      method: 'PATCH',
      url: `/quizzes/${id}`,
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: { title: 'Updated Quiz Title' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.title).toBe('Updated Quiz Title');
  });

  it('should reject quiz updates by a student', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/quizzes/${randomUUID()}`,
      headers: { authorization: `Bearer ${studentToken}` },
      payload: { title: 'Updated Quiz Title' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('should reject invalid quiz updates', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/quizzes',
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: validQuiz(),
    });

    const response = await app.inject({
      method: 'PATCH',
      url: `/quizzes/${created.json().data.id}`,
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: { title: 'A' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should return 404 when updating a nonexistent quiz', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/quizzes/${randomUUID()}`,
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: { title: 'Updated Quiz Title' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('QUIZ_NOT_FOUND');
  });

  it('should delete a quiz as admin', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/quizzes',
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: validQuiz(),
    });

    const id = created.json().data.id;

    const response = await app.inject({
      method: 'DELETE',
      url: `/quizzes/${id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
  });

  it('should reject quiz deletion by faculty', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: `/quizzes/${randomUUID()}`,
      headers: { authorization: `Bearer ${facultyToken}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it('should return 404 when deleting a nonexistent quiz', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: `/quizzes/${randomUUID()}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('QUIZ_NOT_FOUND');
  });
});
