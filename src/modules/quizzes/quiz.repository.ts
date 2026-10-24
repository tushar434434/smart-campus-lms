import { randomUUID } from 'node:crypto';

import type {
  CreateQuizInput,
  CreateQuizQuestionInput,
  UpdateQuizInput,
  UpdateQuizQuestionInput,
} from './quiz.schema.js';

import type {
  Quiz,
  QuizQuestion,
  QuizRepository,
  ReleaseQuizResultsInput,
} from './quiz.repository.interface.js';

export class InMemoryQuizRepository implements QuizRepository {
  private readonly quizzes = new Map<string, Quiz>();
  private readonly questions = new Map<string, QuizQuestion>();

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
    const existing = this.quizzes.get(id);
    if (!existing) return undefined;

    const updated: Quiz = {
      ...existing,
      title: input.title ?? existing.title,
      description: input.description ?? existing.description,
      durationMinutes: input.durationMinutes ?? existing.durationMinutes,
      maxMarks: input.maxMarks ?? existing.maxMarks,
      maxAttempts: input.maxAttempts ?? existing.maxAttempts,
      startsAt:
        input.startsAt === undefined
          ? existing.startsAt
          : input.startsAt === null
            ? null
            : new Date(input.startsAt),
      endsAt:
        input.endsAt === undefined
          ? existing.endsAt
          : input.endsAt === null
            ? null
            : new Date(input.endsAt),
      showMarks: input.showMarks ?? existing.showMarks,
      showCorrectAnswers:
        input.showCorrectAnswers ?? existing.showCorrectAnswers,
      updatedAt: new Date(),
    };

    this.quizzes.set(id, updated);
    return { ...updated };
  }

  async countQuestions(quizId: string): Promise<number> {
    return Array.from(this.questions.values()).filter(
      (question) => question.quizId === quizId,
    ).length;
  }

  async publish(id: string): Promise<Quiz | undefined> {
    const existing = this.quizzes.get(id);
    if (!existing) return undefined;

    const published: Quiz = {
      ...existing,
      status: 'published',
      updatedAt: new Date(),
    };

    this.quizzes.set(id, published);
    return { ...published };
  }

  async releaseResults(
    id: string,
    input: ReleaseQuizResultsInput,
  ): Promise<Quiz | undefined> {
    const existing = this.quizzes.get(id);
    if (!existing) return undefined;

    const updated: Quiz = {
      ...existing,
      resultsReleasedAt: new Date(),
      showMarks: input.showMarks,
      showCorrectAnswers: input.showCorrectAnswers,
      updatedAt: new Date(),
    };

    this.quizzes.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<boolean> {
    if (!this.quizzes.has(id)) return false;

    this.quizzes.delete(id);

    for (const [questionId, question] of this.questions) {
      if (question.quizId === id) {
        this.questions.delete(questionId);
      }
    }

    return true;
  }

  async createQuestion(
    quizId: string,
    input: CreateQuizQuestionInput,
  ): Promise<QuizQuestion | undefined> {
    if (!this.quizzes.has(quizId)) return undefined;

    const question: QuizQuestion = {
      id: randomUUID(),
      quizId,
      questionText: input.questionText,
      optionA: input.optionA,
      optionB: input.optionB,
      optionC: input.optionC,
      optionD: input.optionD,
      correctOption: input.correctOption,
      marks: input.marks,
    };

    this.questions.set(question.id, question);
    return { ...question };
  }

  async findQuestionsByQuizId(quizId: string): Promise<QuizQuestion[]> {
    return Array.from(this.questions.values())
      .filter((question) => question.quizId === quizId)
      .map((question) => ({ ...question }));
  }

  async updateQuestion(
    quizId: string,
    questionId: string,
    input: UpdateQuizQuestionInput,
  ): Promise<QuizQuestion | undefined> {
    const existing = this.questions.get(questionId);

    if (!existing || existing.quizId !== quizId) {
      return undefined;
    }

    const updated: QuizQuestion = {
      ...existing,
      ...(input.questionText !== undefined
        ? { questionText: input.questionText }
        : {}),
      ...(input.optionA !== undefined ? { optionA: input.optionA } : {}),
      ...(input.optionB !== undefined ? { optionB: input.optionB } : {}),
      ...(input.optionC !== undefined ? { optionC: input.optionC } : {}),
      ...(input.optionD !== undefined ? { optionD: input.optionD } : {}),
      ...(input.correctOption !== undefined
        ? { correctOption: input.correctOption }
        : {}),
      ...(input.marks !== undefined ? { marks: input.marks } : {}),
    };

    this.questions.set(questionId, updated);
    return { ...updated };
  }

  async deleteQuestion(quizId: string, questionId: string): Promise<boolean> {
    const existing = this.questions.get(questionId);

    if (!existing || existing.quizId !== quizId) return false;

    return this.questions.delete(questionId);
  }
}
