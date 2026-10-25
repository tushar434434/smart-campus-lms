import { Prisma, PrismaClient } from '../../generated/prisma/client.js';

import type {
  QuizAttempt,
  QuizAttemptRepository,
  QuizAnswerInput,
  QuizAttemptAnswerResult,
  QuizQuestionForAttempt,
  QuizOption,
} from './quiz-attempt.repository.interface.js';

export class PrismaQuizAttemptRepository implements QuizAttemptRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async start(quizId: string, studentId: string): Promise<QuizAttempt> {
    return this.prisma.$transaction(
      async (tx) => {
        const quiz = await tx.quiz.findUnique({
          where: { id: quizId },
          select: {
            id: true,
            courseId: true,
            status: true,
            maxAttempts: true,
          },
        });

        if (!quiz) {
          throw new Error('QUIZ_NOT_FOUND');
        }

        if (quiz.status !== 'published') {
          throw new Error('QUIZ_NOT_PUBLISHED');
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
          throw new Error('STUDENT_NOT_ENROLLED');
        }

        // Serialize attempt creation for this quiz before counting attempts.
        await tx.$queryRaw`
          SELECT id
          FROM "Quiz"
          WHERE id = ${quizId}::uuid
          FOR UPDATE
        `;

        const attemptCount = await tx.quizAttempt.count({
          where: {
            quizId,
            studentId,
          },
        });

        if (attemptCount >= quiz.maxAttempts) {
          throw new Error('MAX_ATTEMPTS_REACHED');
        }

        const attempt = await tx.quizAttempt.create({
          data: {
            quizId,
            studentId,
            status: 'in_progress',
          },
        });

        return this.toQuizAttempt(attempt);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );
  }

  async findById(id: string): Promise<QuizAttempt | undefined> {
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id },
    });

    return attempt ? this.toQuizAttempt(attempt) : undefined;
  }

  async countByQuizAndStudent(
    quizId: string,
    studentId: string,
  ): Promise<number> {
    return this.prisma.quizAttempt.count({
      where: {
        quizId,
        studentId,
      },
    });
  }

  async findQuestions(quizId: string): Promise<QuizQuestionForAttempt[]> {
    return this.prisma.quizQuestion.findMany({
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
    });
  }

  async saveAnswer(input: QuizAnswerInput): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Lock the attempt before checking its status.
      await tx.$queryRaw`
        SELECT id
        FROM "QuizAttempt"
        WHERE id = ${input.attemptId}::uuid
        FOR UPDATE
      `;

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
        select: { id: true },
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
          isCorrect: null,
          marksAwarded: null,
        },
        update: {
          selectedOption: input.selectedOption,
          isCorrect: null,
          marksAwarded: null,
        },
      });
    });
  }

  async submit(
    id: string,
    status: 'submitted' | 'auto_submitted' = 'submitted',
  ): Promise<QuizAttempt | undefined> {
    return this.prisma.$transaction(async (tx) => {
      // Lock the attempt before loading its answers for grading.
      await tx.$queryRaw`
        SELECT id
        FROM "QuizAttempt"
        WHERE id = ${id}::uuid
        FOR UPDATE
      `;

      const attempt = await tx.quizAttempt.findUnique({
        where: { id },
        include: {
          answers: {
            include: {
              question: {
                select: {
                  correctOption: true,
                  marks: true,
                },
              },
            },
          },
        },
      });

      if (!attempt) {
        return undefined;
      }

      if (
        attempt.status === 'submitted' ||
        attempt.status === 'auto_submitted'
      ) {
        return this.toQuizAttempt(attempt);
      }

      let score = 0;

      for (const answer of attempt.answers) {
        const isCorrect =
          answer.selectedOption === answer.question.correctOption;
        const marksAwarded = isCorrect ? answer.question.marks : 0;

        score += marksAwarded;

        await tx.quizAnswer.update({
          where: { id: answer.id },
          data: {
            isCorrect,
            marksAwarded,
          },
        });
      }

      const updatedAttempt = await tx.quizAttempt.update({
        where: { id },
        data: {
          status,
          submittedAt: new Date(),
          score,
        },
      });

      return this.toQuizAttempt(updatedAttempt);
    });
  }

  async findAnswersByAttemptId(
    attemptId: string,
  ): Promise<QuizAttemptAnswerResult[]> {
    const answers = await this.prisma.quizAnswer.findMany({
      where: { attemptId },
      include: {
        question: {
          select: {
            id: true,
            correctOption: true,
            marks: true,
          },
        },
      },
    });

    const validOptions: readonly string[] = ['A', 'B', 'C', 'D'];

    return answers.map((answer): QuizAttemptAnswerResult => {
      const selectedOption = answer.selectedOption;
      const correctOption = answer.question.correctOption;

      if (
        !validOptions.includes(selectedOption) ||
        !validOptions.includes(correctOption)
      ) {
        throw new Error('INVALID_QUIZ_OPTION');
      }

      return {
        questionId: answer.question.id,
        selectedOption: selectedOption as QuizOption,
        correctOption: correctOption as QuizOption,
        marks: answer.question.marks,
        marksAwarded: answer.marksAwarded ?? 0,
      };
    });
  }

  private toQuizAttempt(attempt: {
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
      id: attempt.id,
      quizId: attempt.quizId,
      studentId: attempt.studentId,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      status: attempt.status as QuizAttempt['status'],
      score: attempt.score,
      tabSwitchCount: attempt.tabSwitchCount,
      fullscreenExitCount: attempt.fullscreenExitCount,
      suspiciousActivity: attempt.suspiciousActivity,
    };
  }
}
