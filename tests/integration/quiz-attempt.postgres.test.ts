import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaQuizAttemptRepository } from '../../src/modules/quiz-attempts/quiz-attempt.prisma.repository.js';

dotenv.config({ path: '.env.test', override: true });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set for PostgreSQL integration tests.');
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });
const repository = new PrismaQuizAttemptRepository(prisma);

async function timed<T>(
  label: string,
  operation: () => Promise<T>,
): Promise<T> {
  console.time(label);

  try {
    return await operation();
  } finally {
    console.timeEnd(label);
  }
}

describe('Quiz attempt PostgreSQL integration', () => {
  const suffix = randomUUID();

  let studentId: string | undefined;
  let courseId: string | undefined;
  let quizId: string | undefined;
  let question1Id: string | undefined;
  let question2Id: string | undefined;

  beforeAll(async () => {
    await timed('database connection', () => prisma.$connect());

    const student = await timed('create student', () =>
      prisma.student.create({
        data: {
          name: 'Integration Test Student',
          email: `student-${suffix}@example.test`,
          enrollmentNumber: `IT-${suffix}`,
          department: 'AI-ML',
          semester: 5,
        },
      }),
    );
    studentId = student.id;

    const course = await timed('create course', () =>
      prisma.course.create({
        data: {
          title: 'Integration Test Course',
          code: `IT-${suffix}`,
          credits: 3,
        },
      }),
    );
    courseId = course.id;

    await timed('create enrollment', () =>
      prisma.enrollment.create({
        data: { studentId: student.id, courseId: course.id },
      }),
    );

    const quiz = await timed('create quiz', () =>
      prisma.quiz.create({
        data: {
          courseId: course.id,
          title: 'Integration Test Quiz',
          description: 'PostgreSQL integration test',
          durationMinutes: 30,
          maxMarks: 8,
          maxAttempts: 2,
          status: 'published',
        },
      }),
    );
    quizId = quiz.id;

    const question1 = await timed('create question 1', () =>
      prisma.quizQuestion.create({
        data: {
          quizId: quiz.id,
          questionText: 'What is 2 + 2?',
          optionA: '3',
          optionB: '4',
          optionC: '5',
          optionD: '6',
          correctOption: 'B',
          marks: 5,
        },
      }),
    );
    question1Id = question1.id;

    const question2 = await timed('create question 2', () =>
      prisma.quizQuestion.create({
        data: {
          quizId: quiz.id,
          questionText: 'What is 3 + 3?',
          optionA: '5',
          optionB: '7',
          optionC: '6',
          optionD: '8',
          correctOption: 'C',
          marks: 3,
        },
      }),
    );
    question2Id = question2.id;
  }, 60_000);

  afterAll(async () => {
    try {
      if (quizId) {
        await prisma.quiz.deleteMany({ where: { id: quizId } });
      }

      if (courseId) {
        await prisma.course.deleteMany({ where: { id: courseId } });
      }

      if (studentId) {
        await prisma.student.deleteMany({ where: { id: studentId } });
      }
    } finally {
      await prisma.$disconnect();
    }
  }, 30_000);

  it('persists answers, grades them, and submits an attempt', async () => {
    if (!quizId || !studentId || !question1Id || !question2Id) {
      throw new Error('Integration test fixtures were not initialized.');
    }

    const attempt = await timed('repository.start', () =>
      repository.start(quizId!, studentId!),
    );

    expect(attempt.status).toBe('in_progress');

    await timed('saveAnswer 1', () =>
      repository.saveAnswer({
        attemptId: attempt.id,
        questionId: question1Id!,
        selectedOption: 'B',
      }),
    );

    await timed('saveAnswer 2', () =>
      repository.saveAnswer({
        attemptId: attempt.id,
        questionId: question1Id!,
        selectedOption: 'A',
      }),
    );

    await timed('saveAnswer 3', () =>
      repository.saveAnswer({
        attemptId: attempt.id,
        questionId: question2Id!,
        selectedOption: 'C',
      }),
    );

    const savedAnswers = await timed('find saved answers', () =>
      prisma.quizAnswer.findMany({
        where: { attemptId: attempt.id },
      }),
    );

    expect(savedAnswers).toHaveLength(2);

    const overwrittenAnswer = savedAnswers.find(
      (answer) => answer.questionId === question1Id,
    );
    expect(overwrittenAnswer?.selectedOption).toBe('A');

    const submitted = await timed('repository.submit', () =>
      repository.submit(attempt.id),
    );

    expect(submitted).toBeDefined();
    if (!submitted) {
      throw new Error('Expected submitted quiz attempt to exist');
    }

    expect(submitted.status).toBe('submitted');
    expect(submitted.score).toBe(3);
    expect(submitted.submittedAt).toBeInstanceOf(Date);

    const persistedAttempt = await prisma.quizAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
    });

    expect(persistedAttempt.status).toBe('submitted');
    expect(persistedAttempt.score).toBe(3);

    const gradedAnswers = await prisma.quizAnswer.findMany({
      where: { attemptId: attempt.id },
    });

    const answer1 = gradedAnswers.find(
      (answer) => answer.questionId === question1Id,
    );
    const answer2 = gradedAnswers.find(
      (answer) => answer.questionId === question2Id,
    );

    expect(answer1?.isCorrect).toBe(false);
    expect(answer1?.marksAwarded).toBe(0);
    expect(answer2?.isCorrect).toBe(true);
    expect(answer2?.marksAwarded).toBe(3);

    const submittedAgain = await timed('repository.submit again', () =>
      repository.submit(attempt.id),
    );

    expect(submittedAgain).toBeDefined();
    if (!submittedAgain) {
      throw new Error('Expected previously submitted attempt to exist');
    }

    expect(submittedAgain.status).toBe('submitted');
    expect(submittedAgain.score).toBe(3);
  }, 60_000);

  it('returns quiz questions without exposing correct answers', async () => {
    if (!quizId) {
      throw new Error('Quiz fixture was not initialized.');
    }

    const questions = await repository.findQuestions(quizId);

    expect(questions).toHaveLength(2);

    for (const question of questions) {
      expect(question).not.toHaveProperty('correctOption');
    }
  });

  it('rejects starting an attempt for an unpublished quiz', async () => {
    if (!courseId || !studentId) {
      throw new Error('Course or student fixture was not initialized.');
    }

    const draftQuiz = await prisma.quiz.create({
      data: {
        courseId,
        title: 'Draft Quiz',
        description: 'Integration test',
        durationMinutes: 30,
        maxMarks: 5,
        maxAttempts: 1,
        status: 'draft',
      },
    });

    try {
      await expect(repository.start(draftQuiz.id, studentId)).rejects.toThrow();
    } finally {
      await prisma.quiz.delete({ where: { id: draftQuiz.id } });
    }
  });

  it('rejects saving an answer for a nonexistent attempt', async () => {
    if (!question1Id) {
      throw new Error('Question fixture was not initialized.');
    }

    await expect(
      repository.saveAnswer({
        attemptId: randomUUID(),
        questionId: question1Id,
        selectedOption: 'B',
      }),
    ).rejects.toThrow();
  });
});
