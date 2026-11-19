import { randomUUID } from 'node:crypto';

import type {
  QuizAttempt,
  QuizAttemptRepository,
  QuizAnswerInput,
  QuizAttemptAnswerResult,
  ProctoringEventInput,
  QuizQuestionForAttempt,
} from './quiz-attempt.repository.interface.js';
import type { QuizRepository } from '../quizzes/quiz.repository.interface.js';

export class InMemoryQuizAttemptRepository implements QuizAttemptRepository {
  private readonly attempts = new Map<string, QuizAttempt>();
  private readonly answers = new Map<string, QuizAnswerInput>();
  private readonly bookmarks = new Set<string>();

  constructor(private readonly quizRepository?: QuizRepository) {}

  async start(quizId: string, studentId: string): Promise<QuizAttempt> {
    const active = [...this.attempts.values()].find(
      (attempt) =>
        attempt.quizId === quizId &&
        attempt.studentId === studentId &&
        attempt.status === 'in_progress',
    );
    if (active) return { ...active };

    if (this.quizRepository) {
      const quiz = await this.quizRepository.findById(quizId);
      if (quiz) {
        const attemptCount = await this.countByQuizAndStudent(quizId, studentId);
        if (attemptCount >= quiz.maxAttempts) {
          throw new Error('MAX_ATTEMPTS_REACHED');
        }
      }
    }

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

  async findByQuizId(quizId: string): Promise<QuizAttempt[]> {
    return [...this.attempts.values()]
      .filter((attempt) => attempt.quizId === quizId)
      .sort(
        (left, right) => left.startedAt.getTime() - right.startedAt.getTime(),
      );
  }

  async findByStudentId(studentId: string): Promise<QuizAttempt[]> {
    return [...this.attempts.values()]
      .filter((attempt) => attempt.studentId === studentId)
      .sort(
        (left, right) => right.startedAt.getTime() - left.startedAt.getTime(),
      );
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
        questionType,
        optionA,
        optionB,
        optionC,
        optionD,
        marks,
        imageSlots,
      }) => ({
        id,
        quizId: questionQuizId,
        questionText,
        questionType,
        optionA,
        optionB,
        optionC,
        optionD,
        marks,
        ...(imageSlots !== undefined && { imageSlots }),
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

  async setBookmark(
    attemptId: string,
    questionId: string,
    bookmarked: boolean,
  ): Promise<void> {
    const attempt = this.attempts.get(attemptId);
    if (!attempt) throw new Error('ATTEMPT_NOT_FOUND');
    if (attempt.status !== 'in_progress')
      throw new Error('ATTEMPT_ALREADY_SUBMITTED');
    if (this.quizRepository) {
      const questions = await this.quizRepository.findQuestionsByQuizId(
        attempt.quizId,
      );
      if (!questions.some((question) => question.id === questionId)) {
        throw new Error('QUESTION_NOT_FOUND');
      }
    }
    const key = `${attemptId}:${questionId}`;
    if (bookmarked) this.bookmarks.add(key);
    else this.bookmarks.delete(key);
  }

  async findBookmarkedQuestionIds(attemptId: string): Promise<string[]> {
    if (!this.attempts.has(attemptId)) throw new Error('ATTEMPT_NOT_FOUND');
    const prefix = `${attemptId}:`;
    return [...this.bookmarks]
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length));
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

  async recordProctoringEvent(
    input: ProctoringEventInput,
  ): Promise<QuizAttempt> {
    const attempt = this.attempts.get(input.attemptId);

    if (!attempt) {
      throw new Error('ATTEMPT_NOT_FOUND');
    }

    if (attempt.status !== 'in_progress') {
      throw new Error('ATTEMPT_ALREADY_SUBMITTED');
    }

    if (input.type === 'tab_switch') {
      attempt.tabSwitchCount += 1;
      attempt.suspiciousActivity = true;
    }

    if (input.type === 'fullscreen_exit') {
      attempt.fullscreenExitCount += 1;
      attempt.suspiciousActivity = true;
    }

    this.attempts.set(attempt.id, attempt);
    return { ...attempt };
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
