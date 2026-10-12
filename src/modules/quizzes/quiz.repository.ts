import { randomUUID } from 'node:crypto';

import type { CreateQuizInput, UpdateQuizInput } from './quiz.schema.js';

import type {
  Quiz,
  QuizRepository,
  ReleaseQuizResultsInput,
} from './quiz.repository.interface.js';

export class InMemoryQuizRepository implements QuizRepository {
  private readonly quizzes = new Map<string, Quiz>();

  async create(input: CreateQuizInput): Promise<Quiz> {
    const now = new Date();

    const quiz: Quiz = {
      id: randomUUID(),
      courseId: input.courseId,
      title: input.title,
      description: input.description,
      durationMinutes: input.durationMinutes,
      maxMarks: input.maxMarks,
      maxAttempts: input.maxAttempts,
      status: 'draft',
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      resultsReleasedAt: null,
      showMarks: false,
      showCorrectAnswers: false,
      createdAt: now,
      updatedAt: now,
    };

    this.quizzes.set(quiz.id, quiz);

    return { ...quiz };
  }

  async findAllByCourseId(courseId: string): Promise<Quiz[]> {
    return Array.from(this.quizzes.values())
      .filter((quiz) => quiz.courseId === courseId)
      .map((quiz) => ({ ...quiz }));
  }

  async findById(id: string): Promise<Quiz | undefined> {
    const quiz = this.quizzes.get(id);

    return quiz ? { ...quiz } : undefined;
  }

  async update(id: string, input: UpdateQuizInput): Promise<Quiz | undefined> {
    const existingQuiz = this.quizzes.get(id);

    if (!existingQuiz) {
      return undefined;
    }

    const updatedQuiz: Quiz = {
      ...existingQuiz,
      title: input.title ?? existingQuiz.title,
      description: input.description ?? existingQuiz.description,
      durationMinutes: input.durationMinutes ?? existingQuiz.durationMinutes,
      maxMarks: input.maxMarks ?? existingQuiz.maxMarks,
      maxAttempts: input.maxAttempts ?? existingQuiz.maxAttempts,
      startsAt:
        input.startsAt === undefined
          ? existingQuiz.startsAt
          : input.startsAt === null
            ? null
            : new Date(input.startsAt),
      endsAt:
        input.endsAt === undefined
          ? existingQuiz.endsAt
          : input.endsAt === null
            ? null
            : new Date(input.endsAt),
      showMarks: input.showMarks ?? existingQuiz.showMarks,
      showCorrectAnswers:
        input.showCorrectAnswers ?? existingQuiz.showCorrectAnswers,
      updatedAt: new Date(),
    };

    this.quizzes.set(id, updatedQuiz);

    return { ...updatedQuiz };
  }

  async releaseResults(
    id: string,
    input: ReleaseQuizResultsInput,
  ): Promise<Quiz | undefined> {
    const existingQuiz = this.quizzes.get(id);

    if (!existingQuiz) {
      return undefined;
    }

    const now = new Date();

    const updatedQuiz: Quiz = {
      ...existingQuiz,
      resultsReleasedAt: now,
      showMarks: input.showMarks,
      showCorrectAnswers: input.showCorrectAnswers,
      updatedAt: now,
    };

    this.quizzes.set(id, updatedQuiz);

    return { ...updatedQuiz };
  }

  async delete(id: string): Promise<boolean> {
    return this.quizzes.delete(id);
  }
}
