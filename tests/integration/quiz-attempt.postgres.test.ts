import dotenv from 'dotenv';

dotenv.config({ path: '.env.test', override: true });
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaQuizAttemptRepository } from '../../src/modules/quiz-attempts/quiz-attempt.prisma.repository.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set for PostgreSQL integration tests.');
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });
const repository = new PrismaQuizAttemptRepository(prisma);

describe('Quiz attempt PostgreSQL integration', () => {
  const suffix = randomUUID();

  let studentId: string;
  let courseId: string;
  let quizId: string;
  let question1Id: string;
  let question2Id: string;

  beforeAll(async () => {
    const student = await prisma.student.create({
      data: {
        name: 'Integration Test Student',
        email: `student-${suffix}@example.test`,
        enrollmentNumber: `IT-${suffix}`,
        department: 'AI-ML',
        semester: 5,
      },
    });
    studentId = student.id;

    const course = await prisma.course.create({
      data: {
        title: 'Integration Test Course',
        code: `IT-${suffix}`,
        credits: 3,
      },
    });
    courseId = course.id;

    await prisma.enrollment.create({
      data: {
        studentId,
        courseId,
      },
    });

    const quiz = await prisma.quiz.create({
      data: {
        courseId,
        title: 'Integration Test Quiz',
        description: 'PostgreSQL integration test',
        durationMinutes: 30,
        maxMarks: 8,
        maxAttempts: 2,
        status: 'published',
      },
    });
    quizId = quiz.id;

    const question1 = await prisma.quizQuestion.create({
      data: {
        quizId,
        questionText: 'What is 2 + 2?',
        optionA: '3',
        optionB: '4',
        optionC: '5',
        optionD: '6',
        correctOption: 'B',
        marks: 5,
      },
    });
    question1Id = question1.id;

    const question2 = await prisma.quizQuestion.create({
      data: {
        quizId,
        questionText: 'What is 3 + 3?',
        optionA: '5',
        optionB: '7',
        optionC: '6',
        optionD: '8',
        correctOption: 'C',
        marks: 3,
      },
    });
    question2Id = question2.id;
  });

  afterAll(async () => {
    try {
      if (quizId) {
        await prisma.quiz.deleteMany({
          where: { id: quizId },
        });
      }

      if (courseId) {
        await prisma.course.deleteMany({
          where: { id: courseId },
        });
      }

      if (studentId) {
        await prisma.student.deleteMany({
          where: { id: studentId },
        });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  it('persists answers, grades them, and submits an attempt', async () => {
    const attempt = await repository.start(quizId, studentId);

    expect(attempt.status).toBe('in_progress');

    // Save an answer, then overwrite it.
    await repository.saveAnswer({
      attemptId: attempt.id,
      questionId: question1Id,
      selectedOption: 'B',
    });

    await repository.saveAnswer({
      attemptId: attempt.id,
      questionId: question1Id,
      selectedOption: 'A',
    });

    await repository.saveAnswer({
      attemptId: attempt.id,
      questionId: question2Id,
      selectedOption: 'C',
    });

    const savedAnswers = await prisma.quizAnswer.findMany({
      where: { attemptId: attempt.id },
    });

    expect(savedAnswers).toHaveLength(2);

    const overwrittenAnswer = savedAnswers.find(
      (answer) => answer.questionId === question1Id,
    );

    expect(overwrittenAnswer?.selectedOption).toBe('A');

    // Submit and verify the result.
    const submitted = await repository.submit(attempt.id);

    expect(submitted).toBeDefined();

    if (!submitted) {
      throw new Error('Expected submitted quiz attempt to exist');
    }

    expect(submitted.status).toBe('submitted');
    expect(submitted.score).toBe(3);
    expect(submitted.submittedAt).toBeInstanceOf(Date);

    // Verify the attempt was persisted.
    const persistedAttempt = await prisma.quizAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
    });

    expect(persistedAttempt.status).toBe('submitted');
    expect(persistedAttempt.score).toBe(3);

    // Verify each answer was graded correctly.
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

    // Submitting again should not change the score.
    const submittedAgain = await repository.submit(attempt.id);

    expect(submittedAgain).toBeDefined();

    if (!submittedAgain) {
      throw new Error('Expected previously submitted attempt to exist');
    }

    expect(submittedAgain.status).toBe('submitted');
    expect(submittedAgain.score).toBe(3);
  });

  it('returns quiz questions without exposing correct answers', async () => {
    const questions = await repository.findQuestions(quizId);

    expect(questions).toHaveLength(2);

    for (const question of questions) {
      expect(question).not.toHaveProperty('correctOption');
    }
  });

  it('rejects starting an attempt for an unpublished quiz', async () => {
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
      await prisma.quiz.delete({
        where: { id: draftQuiz.id },
      });
    }
  });

  it('rejects saving an answer for a nonexistent attempt', async () => {
    await expect(
      repository.saveAnswer({
        attemptId: randomUUID(),
        questionId: question1Id,
        selectedOption: 'B',
      }),
    ).rejects.toThrow();
  });
});
