import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { createTestContainer } from '../src/test-container.js';

describe('Quiz attempt API workflow', () => {
  const container = createTestContainer();
  const app: FastifyInstance = buildApp(container as never);

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
    await container.courseService.approve(course.id, 'workflow-admin');

    const student = await container.studentRepository.create({
      name: 'Workflow Test Student',
      email: 'workflow-test@example.test',
      enrollmentNumber: 'WF-TEST-001',
      department: 'AI-ML',
      semester: 5,
    });

    studentId = student.id;

    const authUser = await container.authRepository.create({
      name: 'Workflow Test User',
      email: 'workflow-user@example.test',
      passwordHash: 'not-used-in-this-test',
      role: 'student',
    });

    userId = authUser.id;

    // Link the authenticated user to the student record.
    await container.studentRepository.linkUser(studentId, userId);

    await container.enrollmentRepository.create({
      studentId,
      courseId: course.id,
      status: 'approved',
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

describe('Quiz attempt student access', () => {
  it('lets a matching unlinked student start after approved enrollment', async () => {
    const container = createTestContainer();
    const app = buildApp(container as never);
    await app.ready();

    const course = await container.courseRepository.create({
      title: 'Access Course',
      code: 'ACCESS-1',
      credits: 3,
    });
    await container.courseService.approve(course.id, 'access-admin');
    const student = await container.studentRepository.create({
      name: 'Matching Student',
      email: 'matching-student@example.test',
      department: 'CSE',
      semester: 4,
    });
    const account = await container.authRepository.create({
      name: 'Matching Student',
      email: 'matching-student@example.test',
      passwordHash: 'unused',
      role: 'student',
    });
    await container.enrollmentRepository.create({
      studentId: student.id,
      courseId: course.id,
      status: 'approved',
    });
    const quiz = await container.quizRepository.create({
      courseId: course.id,
      title: 'Access Quiz',
      description: 'Published assessment',
      durationMinutes: 20,
      maxMarks: 1,
      maxAttempts: 1,
    });
    await container.quizRepository.createQuestion(quiz.id, {
      questionText: '1 + 1?',
      optionA: '1',
      optionB: '2',
      optionC: '3',
      optionD: '4',
      correctOption: 'B',
      marks: 1,
    });
    await container.quizRepository.publish(quiz.id);

    const response = await app.inject({
      method: 'POST',
      url: `/quizzes/${quiz.id}/attempts`,
      headers: {
        authorization: `Bearer ${app.jwt.sign({ sub: account.id, role: 'student' })}`,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(await container.studentRepository.findByUserId(account.id)).toMatchObject({
      id: student.id,
    });
    await app.close();
  });

  it('rejects a student without a matching profile or approved enrollment', async () => {
    const container = createTestContainer();
    const app = buildApp(container as never);
    await app.ready();

    const course = await container.courseRepository.create({
      title: 'Denied Course',
      code: 'ACCESS-2',
      credits: 3,
    });
    await container.courseService.approve(course.id, 'access-admin');
    await container.studentRepository.create({
      name: 'Other Profile',
      email: 'other-profile@example.test',
      department: 'CSE',
      semester: 4,
    });
    const account = await container.authRepository.create({
      name: 'Unmatched Student',
      email: 'unmatched-student@example.test',
      passwordHash: 'unused',
      role: 'student',
    });
    const quiz = await container.quizRepository.create({
      courseId: course.id,
      title: 'Denied Quiz',
      description: 'Published assessment',
      durationMinutes: 20,
      maxMarks: 1,
      maxAttempts: 1,
    });
    await container.quizRepository.createQuestion(quiz.id, {
      questionText: '1 + 1?',
      optionA: '1',
      optionB: '2',
      optionC: '3',
      optionD: '4',
      correctOption: 'B',
      marks: 1,
    });
    await container.quizRepository.publish(quiz.id);

    const unmatched = await app.inject({
      method: 'POST',
      url: `/quizzes/${quiz.id}/attempts`,
      headers: {
        authorization: `Bearer ${app.jwt.sign({ sub: account.id, role: 'student' })}`,
      },
    });
    expect(unmatched.statusCode).toBe(403);
    expect(unmatched.json().error.code).toBe('STUDENT_NOT_LINKED');

    const linkedStudent = await container.studentRepository.create({
      name: 'Pending Student',
      email: 'pending-student@example.test',
      department: 'CSE',
      semester: 4,
    });
    const pendingAccount = await container.authRepository.create({
      name: 'Pending Student',
      email: 'pending-student@example.test',
      passwordHash: 'unused',
      role: 'student',
    });
    await container.studentRepository.linkUser(linkedStudent.id, pendingAccount.id);
    await container.enrollmentRepository.create({
      studentId: linkedStudent.id,
      courseId: course.id,
      status: 'pending',
    });

    const pending = await app.inject({
      method: 'POST',
      url: `/quizzes/${quiz.id}/attempts`,
      headers: {
        authorization: `Bearer ${app.jwt.sign({
          sub: pendingAccount.id,
          role: 'student',
        })}`,
      },
    });
    expect(pending.statusCode).toBe(403);
    expect(pending.json().error.code).toBe('NOT_ENROLLED');
    await app.close();
  });
});
