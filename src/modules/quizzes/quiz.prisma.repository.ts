
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaClient } from '../../generated/prisma/client.js';

import type {
  Quiz,
  QuizRepository,
  ReleaseQuizResultsInput,
} from './quiz.repository.interface.js';

import type { CreateQuizInput, UpdateQuizInput } from './quiz.schema.js';

export class PrismaQuizRepository implements QuizRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateQuizInput): Promise<Quiz> {
    const quiz = await this.prisma.quiz.create({
      data: {
        courseId: input.courseId,
        title: input.title,
        description: input.description,
        durationMinutes: input.durationMinutes,
        maxMarks: input.maxMarks,
        maxAttempts: input.maxAttempts,
        ...(input.startsAt && {
          startsAt: new Date(input.startsAt),
        }),
        ...(input.endsAt && {
          endsAt: new Date(input.endsAt),
        }),
      },
    });

    return this.toQuiz(quiz);
  }

  async findAllByCourseId(courseId: string): Promise<Quiz[]> {
    const quizzes = await this.prisma.quiz.findMany({
      where: { courseId },
      orderBy: { createdAt: 'desc' },
    });

    return quizzes.map((quiz) => this.toQuiz(quiz));
  }

  async findById(id: string): Promise<Quiz | undefined> {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
    });

    return quiz ? this.toQuiz(quiz) : undefined;
  }

  async update(id: string, input: UpdateQuizInput): Promise<Quiz | undefined> {
    try {
      const quiz = await this.prisma.quiz.update({
        where: { id },
        data: {
          ...(input.title !== undefined && {
            title: input.title,
          }),
          ...(input.description !== undefined && {
            description: input.description,
          }),
          ...(input.durationMinutes !== undefined && {
            durationMinutes: input.durationMinutes,
          }),
          ...(input.maxMarks !== undefined && {
            maxMarks: input.maxMarks,
          }),
          ...(input.maxAttempts !== undefined && {
            maxAttempts: input.maxAttempts,
          }),
          ...(input.startsAt !== undefined && {
            startsAt: input.startsAt ? new Date(input.startsAt) : null,
          }),
          ...(input.endsAt !== undefined && {
            endsAt: input.endsAt ? new Date(input.endsAt) : null,
          }),
          ...(input.showMarks !== undefined && {
            showMarks: input.showMarks,
          }),
          ...(input.showCorrectAnswers !== undefined && {
            showCorrectAnswers: input.showCorrectAnswers,
          }),
        },
      });

      return this.toQuiz(quiz);
    } catch (error: unknown) {
      if (this.isRecordNotFoundError(error)) {
        return undefined;
      }

      throw error;
    }
  }

  async countQuestions(id: string): Promise<number> {
    return this.prisma.quizQuestion.count({
      where: { quizId: id },
    });
  }

  async publish(id: string): Promise<Quiz | undefined> {
    try {
      const quiz = await this.prisma.quiz.update({
        where: { id },
        data: {
          status: 'published',
        },
      });

      return this.toQuiz(quiz);
    } catch (error: unknown) {
      if (this.isRecordNotFoundError(error)) {
        return undefined;
      }

      throw error;
    }
  }

  async releaseResults(
    id: string,
    input: ReleaseQuizResultsInput,
  ): Promise<Quiz | undefined> {
    try {
      const quiz = await this.prisma.quiz.update({
        where: { id },
        data: {
          resultsReleasedAt: new Date(),
          showMarks: input.showMarks,
          showCorrectAnswers: input.showCorrectAnswers,
        },
      });

      return this.toQuiz(quiz);
    } catch (error: unknown) {
      if (this.isRecordNotFoundError(error)) {
        return undefined;
      }

      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.quiz.delete({
        where: { id },
      });

      return true;
    } catch (error: unknown) {
      if (this.isRecordNotFoundError(error)) {
        return false;
      }

      throw error;
    }
  }

  private isRecordNotFoundError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    );
  }

  private toQuiz(quiz: {
    id: string;
    courseId: string;
    title: string;
    description: string;
    durationMinutes: number;
    maxMarks: number;
    maxAttempts: number;
    status: Quiz['status'];
    startsAt: Date | null;
    endsAt: Date | null;
    resultsReleasedAt: Date | null;
    showMarks: boolean;
    showCorrectAnswers: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Quiz {
    return {
      id: quiz.id,
      courseId: quiz.courseId,
      title: quiz.title,
      description: quiz.description,
      durationMinutes: quiz.durationMinutes,
      maxMarks: quiz.maxMarks,
      maxAttempts: quiz.maxAttempts,
      status: quiz.status,
      startsAt: quiz.startsAt,
      endsAt: quiz.endsAt,
      resultsReleasedAt: quiz.resultsReleasedAt,
      showMarks: quiz.showMarks,
      showCorrectAnswers: quiz.showCorrectAnswers,
      createdAt: quiz.createdAt,
      updatedAt: quiz.updatedAt,
    };
  }
}
