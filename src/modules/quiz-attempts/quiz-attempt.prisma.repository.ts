import { PrismaClient } from '../../generated/prisma/client.js';
import type {
  QuizAttempt,
  QuizAttemptRepository,
  QuizAnswerInput,
  QuizQuestionForAttempt,
} from './quiz-attempt.repository.interface.js';

export class PrismaQuizAttemptRepository implements QuizAttemptRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async start(quizId: string, studentId: string): Promise<QuizAttempt> {
    return this.prisma.$transaction(async (tx) => {
      const quiz = await tx.quiz.findUnique({
        where: { id: quizId },
        include: {
          _count: {
            select: {
              attempts: {
                where: { studentId },
              },
            },
          },
        },
      });

      if (!quiz) {
        throw new Error('QUIZ_NOT_FOUND');
      }

      if (quiz.status !== 'published') {
        throw new Error('QUIZ_NOT_AVAILABLE');
      }

      const now = new Date();

      if (quiz.startsAt && now < quiz.startsAt) {
        throw new Error('QUIZ_NOT_STARTED');
      }

      if (quiz.endsAt && now > quiz.endsAt) {
        throw new Error('QUIZ_ENDED');
      }

      const enrollment = await tx.enrollment.findUnique({
        where: {
          studentId_courseId: {
            studentId,
            courseId: quiz.courseId,
          },
        },
      });

      if (!enrollment) {
        throw new Error('NOT_ENROLLED');
      }

      if (quiz._count.attempts >= quiz.maxAttempts) {
        throw new Error('MAX_ATTEMPTS_REACHED');
      }

      const attempt = await tx.quizAttempt.create({
        data: { quizId, studentId },
      });

      return this.toAttempt(attempt);
    });
  }

  async findById(id: string): Promise<QuizAttempt | undefined> {
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id },
    });

    return attempt ? this.toAttempt(attempt) : undefined;
  }

  async findQuestions(quizId: string): Promise<QuizQuestionForAttempt[]> {
    const questions = await this.prisma.quizQuestion.findMany({
      where: { quizId },
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
      orderBy: { id: 'asc' },
    });

    return questions;
  }

  async saveAnswer(input: QuizAnswerInput): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const attempt = await tx.quizAttempt.findUnique({
        where: { id: input.attemptId },
      });

      if (!attempt) {
        throw new Error('ATTEMPT_NOT_FOUND');
      }

      if (attempt.status !== 'in_progress') {
        throw new Error('ATTEMPT_ALREADY_SUBMITTED');
      }

      const question = await tx.quizQuestion.findFirst({
        where: {
          id: input.questionId,
          quizId: attempt.quizId,
        },
      });

      if (!question) {
        throw new Error('QUESTION_NOT_FOUND');
      }

      await tx.quizAnswer.upsert({
        where: {
          attemptId_questionId: {
            attemptId: input.attemptId,
            questionId: input.questionId,
          },
        },
        create: {
          attemptId: input.attemptId,
          questionId: input.questionId,
          selectedOption: input.selectedOption,
        },
        update: {
          selectedOption: input.selectedOption,
        },
      });
    });
  }

  async submit(id: string): Promise<QuizAttempt | undefined> {
    return this.prisma.$transaction(async (tx) => {
      const attempt = await tx.quizAttempt.findUnique({
        where: { id },
        include: {
          answers: {
            include: { question: true },
          },
        },
      });

      if (!attempt) {
        return undefined;
      }

      if (attempt.status !== 'in_progress') {
        throw new Error('ATTEMPT_ALREADY_SUBMITTED');
      }

      let score = 0;

      for (const answer of attempt.answers) {
        const isCorrect =
          answer.selectedOption === answer.question.correctOption;
        const marksAwarded = isCorrect ? answer.question.marks : 0;

        score += marksAwarded;

        await tx.quizAnswer.update({
          where: { id: answer.id },
          data: { isCorrect, marksAwarded },
        });
      }

      const updated = await tx.quizAttempt.update({
        where: { id },
        data: {
          score,
          submittedAt: new Date(),
          status: 'submitted',
        },
      });

      return this.toAttempt(updated);
    });
  }

  private toAttempt(attempt: {
    id: string;
    quizId: string;
    studentId: string;
    startedAt: Date;
    submittedAt: Date | null;
    status: string;
    score: number | null;
    tabSwitchCount: number;
    fullscreenExitCount: number;
    suspiciousActivity: boolean;
  }): QuizAttempt {
    return {
      ...attempt,
      status: attempt.status as QuizAttempt['status'],
    };
  }
}
