import { randomUUID } from 'node:crypto';

import type {
  QuizAttempt,
  QuizAttemptRepository,
  QuizAnswerInput,
  QuizAttemptAnswerResult,
  QuizQuestionForAttempt,
} from './quiz-attempt.repository.interface.js';
import type { QuizRepository } from '../quizzes/quiz.repository.interface.js';

export class InMemoryQuizAttemptRepository implements QuizAttemptRepository {
  private readonly attempts = new Map<string, QuizAttempt>();
  private readonly answers = new Map<string, QuizAnswerInput>();

  constructor(private readonly quizRepository?: QuizRepository) {}

  async start(quizId: string, studentId: string): Promise<QuizAttempt> {
    const attempt: QuizAttempt = {
      id: randomUUID(),
      quizId,
      studentId,
      startedAt: new Date(),
      submittedAt: null,
      status: 'in_progress',
      score: null,
      tabSwitchCount: 0,
      fullscreenExitCount: 0,
      suspiciousActivity: false,
    };

    this.attempts.set(attempt.id, attempt);
    return { ...attempt };
  }

  async findById(id: string): Promise<QuizAttempt | undefined> {
    const attempt = this.attempts.get(id);
    return attempt ? { ...attempt } : undefined;
  }

  async countByQuizAndStudent(
    quizId: string,
    studentId: string,
  ): Promise<number> {
    return [...this.attempts.values()].filter(
      (attempt) => attempt.quizId === quizId && attempt.studentId === studentId,
    ).length;
  }

  async findQuestions(quizId: string): Promise<QuizQuestionForAttempt[]> {
    if (!this.quizRepository) {
      return [];
    }

    const questions = await this.quizRepository.findQuestionsByQuizId(quizId);

    return questions.map(
      ({
        id,
        quizId: questionQuizId,
        questionText,
        optionA,
        optionB,
        optionC,
        optionD,
        marks,
      }) => ({
        id,
        quizId: questionQuizId,
        questionText,
        optionA,
        optionB,
        optionC,
        optionD,
        marks,
      }),
    );
  }

  async saveAnswer(input: QuizAnswerInput): Promise<void> {
    const attempt = this.attempts.get(input.attemptId);

    if (!attempt) {
      throw new Error('ATTEMPT_NOT_FOUND');
    }

    if (attempt.status !== 'in_progress') {
      throw new Error('ATTEMPT_ALREADY_SUBMITTED');
    }

    if (this.quizRepository) {
      const questions = await this.quizRepository.findQuestionsByQuizId(
        attempt.quizId,
      );

      if (!questions.some((question) => question.id === input.questionId)) {
        throw new Error('QUESTION_NOT_FOUND');
      }
    }

    this.answers.set(`${input.attemptId}:${input.questionId}`, input);
  }

  async findAnswersByAttemptId(
    attemptId: string,
  ): Promise<QuizAttemptAnswerResult[]> {
    const attempt = this.attempts.get(attemptId);

    if (!attempt) {
      throw new Error('ATTEMPT_NOT_FOUND');
    }

    if (!this.quizRepository) {
      return [];
    }

    const questions = await this.quizRepository.findQuestionsByQuizId(
      attempt.quizId,
    );

    return questions.flatMap((question) => {
      const answer = this.answers.get(`${attemptId}:${question.id}`);

      if (!answer) {
        return [];
      }

      const isCorrect = answer.selectedOption === question.correctOption;

      return [
        {
          questionId: question.id,
          selectedOption: answer.selectedOption,
          correctOption: question.correctOption,
          marks: question.marks,
          marksAwarded: isCorrect ? question.marks : 0,
        },
      ];
    });
  }

  async submit(
    id: string,
    status: 'submitted' | 'auto_submitted' = 'submitted',
  ): Promise<QuizAttempt | undefined> {
    const attempt = this.attempts.get(id);

    if (!attempt) {
      return undefined;
    }

    if (attempt.status !== 'in_progress') {
      return { ...attempt };
    }

    let score = 0;

    if (this.quizRepository) {
      const questions = await this.quizRepository.findQuestionsByQuizId(
        attempt.quizId,
      );

      for (const question of questions) {
        const answer = this.answers.get(`${id}:${question.id}`);

        if (answer && answer.selectedOption === question.correctOption) {
          score += question.marks;
        }
      }
    }

    const updated: QuizAttempt = {
      ...attempt,
      status,
      submittedAt: new Date(),
      score,
    };

    this.attempts.set(id, updated);
    return { ...updated };
  }
}
