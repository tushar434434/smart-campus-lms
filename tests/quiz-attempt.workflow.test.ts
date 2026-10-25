import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { createTestContainer } from '../src/test-container.js';

describe('Quiz attempt API workflow', () => {
  const container = createTestContainer();
  const app: FastifyInstance = buildApp(container);

  let quizId: string;
  let questionId: string;
  let studentId: string;
  let userId: string;
  let attemptId: string;
  let token: string;

  beforeAll(async () => {
    await app.ready();

    const course = await container.courseRepository.create({
      title: 'Workflow Test Course',
      code: 'WF-TEST',
      credits: 3,
    });

    const student = await container.studentRepository.create({
      name: 'Workflow Test Student',
      email: 'workflow-test@example.test',
      enrollmentNumber: 'WF-TEST-001',
      department: 'AI-ML',
      semester: 5,
    });

    studentId = student.id;

    const authUser = await container.authRepository.create({
      email: 'workflow-user@example.test',
      passwordHash: 'not-used-in-this-test',
      role: 'student',
    });

    userId = authUser.id;

    // Link the authenticated user to the student record.
    await container.studentRepository.update(studentId, {
      userId,
    });

    await container.enrollmentRepository.create({
      studentId,
      courseId: course.id,
    });

    const quiz = await container.quizRepository.create({
      courseId: course.id,
      title: 'Workflow Test Quiz',
      description: 'API workflow integration test',
      durationMinutes: 30,
      maxMarks: 2,
      maxAttempts: 1,
    });

    quizId = quiz.id;

    const question = await container.quizRepository.createQuestion(quizId, {
      questionText: 'What is 2 + 2?',
      optionA: '3',
      optionB: '4',
      optionC: '5',
      optionD: '6',
      correctOption: 'B',
      marks: 2,
    });

    if (!question) {
      throw new Error('Failed to create workflow test question');
    }

    questionId = question.id;

    await container.quizRepository.publish(quizId);

    token = app.jwt.sign({ sub: userId, role: 'student' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('starts, answers, and submits a quiz through the API', async () => {
    const startResponse = await app.inject({
      method: 'POST',
      url: `/quizzes/${quizId}/attempts`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(startResponse.statusCode).toBe(201);
    attemptId = startResponse.json().data.id;

    const questionsResponse = await app.inject({
      method: 'GET',
      url: `/attempts/${attemptId}/questions`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(questionsResponse.statusCode).toBe(200);
    expect(questionsResponse.json().data).toHaveLength(1);
    expect(questionsResponse.json().data[0]).not.toHaveProperty(
      'correctOption',
    );

    const answerResponse = await app.inject({
      method: 'PUT',
      url: `/attempts/${attemptId}/answers/${questionId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { selectedOption: 'B' },
    });

    expect(answerResponse.statusCode).toBe(200);

    const submitResponse = await app.inject({
      method: 'POST',
      url: `/attempts/${attemptId}/submit`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(submitResponse.statusCode).toBe(200);
    expect(submitResponse.json().data.status).toBe('submitted');

    // Marks are hidden until the quiz releases results.
    expect(submitResponse.json().data.score).toBeNull();
  });
});
