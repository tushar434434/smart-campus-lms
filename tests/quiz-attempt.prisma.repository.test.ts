import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaQuizAttemptRepository } from '../src/modules/quiz-attempts/quiz-attempt.prisma.repository.js';

describe('PrismaQuizAttemptRepository', () => {
  let repository: PrismaQuizAttemptRepository;

  const question = {
    id: 'question-1',
    quizId: 'quiz-1',
    questionText: 'What is 2 + 2?',
    optionA: '3',
    optionB: '4',
    optionC: '5',
    optionD: '6',
    correctOption: 'B',
    marks: 5,
  };

  const publicQuestion = {
    id: 'question-1',
    quizId: 'quiz-1',
    questionText: 'What is 2 + 2?',
    optionA: '3',
    optionB: '4',
    optionC: '5',
    optionD: '6',
    marks: 5,
  };

  const attempt = {
    id: 'attempt-1',
    quizId: 'quiz-1',
    studentId: 'student-1',
    startedAt: new Date('2026-10-23T09:00:00Z'),
    submittedAt: null,
    status: 'in_progress',
    score: null,
    tabSwitchCount: 0,
    fullscreenExitCount: 0,
    suspiciousActivity: false,
  };

  let tx: {
    quiz: { findUnique: ReturnType<typeof vi.fn> };
    enrollment: { findUnique: ReturnType<typeof vi.fn> };
    quizAttempt: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    quizQuestion: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    quizAnswer: {
      upsert: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };

  let prisma: typeof tx & {
    $transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    tx = {
      quiz: { findUnique: vi.fn() },
      enrollment: { findUnique: vi.fn() },
      quizAttempt: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      quizQuestion: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      quizAnswer: {
        upsert: vi.fn(),
        update: vi.fn(),
      },
    };

    prisma = {
      ...tx,
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => unknown) =>
          callback(tx),
      ),
    };

    repository = new PrismaQuizAttemptRepository(prisma as never);
  });

  it('returns questions without exposing correctOption', async () => {
    // Mock only the fields that students are allowed to see.
    tx.quizQuestion.findMany.mockResolvedValue([publicQuestion]);

    const result = await repository.findQuestions('quiz-1');

    expect(tx.quizQuestion.findMany).toHaveBeenCalledWith({
      where: { quizId: 'quiz-1' },
      select: {
        id: true,
        quizId: true,
        questionText: true,
        optionA: true,
        optionB: true,
        optionC: true,
        optionD: true,
        marks: true,
      },
    });

    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty('correctOption');
  });

  it('rejects answers for questions belonging to another quiz', async () => {
    tx.quizAttempt.findUnique.mockResolvedValue(attempt);
    tx.quizQuestion.findFirst.mockResolvedValue(null);

    await expect(
      repository.saveAnswer({
        attemptId: 'attempt-1',
        questionId: 'question-from-another-quiz',
        selectedOption: 'A',
      }),
    ).rejects.toThrow('QUESTION_NOT_FOUND');

    expect(tx.quizAnswer.upsert).not.toHaveBeenCalled();
  });

  it('rejects saving answers after submission', async () => {
    tx.quizAttempt.findUnique.mockResolvedValue({
      ...attempt,
      status: 'submitted',
    });

    await expect(
      repository.saveAnswer({
        attemptId: 'attempt-1',
        questionId: 'question-1',
        selectedOption: 'B',
      }),
    ).rejects.toThrow('ATTEMPT_ALREADY_SUBMITTED');

    expect(tx.quizQuestion.findFirst).not.toHaveBeenCalled();
    expect(tx.quizAnswer.upsert).not.toHaveBeenCalled();
  });

  it('calculates the score and marks correct and incorrect answers', async () => {
    const submittedAt = new Date('2026-10-23T09:20:00Z');

    tx.quizAttempt.findUnique.mockResolvedValue({
      ...attempt,
      answers: [
        {
          id: 'answer-1',
          selectedOption: 'B',
          question: {
            ...question,
            correctOption: 'B',
            marks: 5,
          },
        },
        {
          id: 'answer-2',
          selectedOption: 'A',
          question: {
            ...question,
            id: 'question-2',
            correctOption: 'C',
            marks: 3,
          },
        },
      ],
    });

    tx.quizAnswer.update.mockResolvedValue({});

    tx.quizAttempt.update.mockResolvedValue({
      ...attempt,
      score: 5,
      status: 'submitted',
      submittedAt,
    });

    const result = await repository.submit('attempt-1');

    expect(tx.quizAnswer.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'answer-1' },
      data: { isCorrect: true, marksAwarded: 5 },
    });

    expect(tx.quizAnswer.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'answer-2' },
      data: { isCorrect: false, marksAwarded: 0 },
    });

    expect(tx.quizAttempt.update).toHaveBeenCalledWith({
      where: { id: 'attempt-1' },
      data: expect.objectContaining({
        score: 5,
        status: 'submitted',
        submittedAt: expect.any(Date),
      }),
    });

    expect(result?.score).toBe(5);
    expect(result?.status).toBe('submitted');
    expect(result?.submittedAt).toEqual(submittedAt);
  });

  it('supports automatic submission', async () => {
    const submittedAt = new Date('2026-10-23T09:20:00Z');

    tx.quizAttempt.findUnique.mockResolvedValue({
      ...attempt,
      answers: [],
    });

    tx.quizAttempt.update.mockResolvedValue({
      ...attempt,
      score: 0,
      status: 'auto_submitted',
      submittedAt,
    });

    const result = await repository.submit(
      'attempt-1',
      'auto_submitted',
    );

    expect(tx.quizAttempt.update).toHaveBeenCalledWith({
      where: { id: 'attempt-1' },
      data: expect.objectContaining({
        score: 0,
        status: 'auto_submitted',
        submittedAt: expect.any(Date),
      }),
    });

    expect(result?.status).toBe('auto_submitted');
    expect(result?.score).toBe(0);
  });

  it('returns undefined when the attempt does not exist', async () => {
    tx.quizAttempt.findUnique.mockResolvedValue(null);

    await expect(
      repository.submit('missing-attempt'),
    ).resolves.toBeUndefined();

    expect(tx.quizAttempt.update).not.toHaveBeenCalled();
  });

  it('does not score an already-submitted attempt again', async () => {
    const submittedAttempt = {
      ...attempt,
      status: 'submitted',
      score: 5,
      submittedAt: new Date(),
      answers: [],
    };

    tx.quizAttempt.findUnique.mockResolvedValue(submittedAttempt);

    const result = await repository.submit('attempt-1');

    expect(result?.status).toBe('submitted');
    expect(result?.score).toBe(5);
    expect(tx.quizAnswer.update).not.toHaveBeenCalled();
    expect(tx.quizAttempt.update).not.toHaveBeenCalled();
  });
});
