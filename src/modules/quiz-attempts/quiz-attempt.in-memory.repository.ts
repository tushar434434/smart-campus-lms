import type {
  QuizAttempt,
  QuizAttemptRepository,
  QuizAnswerInput,
  QuizQuestionForAttempt,
} from './quiz-attempt.repository.interface.js';

export class InMemoryQuizAttemptRepository implements QuizAttemptRepository {
  private attempts = new Map<string, QuizAttempt>();
  private answers = new Map<string, QuizAnswerInput>();

  async start(quizId: string, studentId: string): Promise<QuizAttempt> {
    const attempt: QuizAttempt = {
      id: crypto.randomUUID(),
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

  async findQuestions(): Promise<QuizQuestionForAttempt[]> {
    return [];
  }

  async saveAnswer(input: QuizAnswerInput): Promise<void> {
    this.answers.set(`${input.attemptId}:${input.questionId}`, input);
  }

  async submit(
    id: string,
    status: 'submitted' | 'auto_submitted' = 'submitted',
  ): Promise<QuizAttempt | undefined> {
    const attempt = this.attempts.get(id);

    if (!attempt) return undefined;
    if (attempt.status !== 'in_progress') return { ...attempt };

    const updated: QuizAttempt = {
      ...attempt,
      status,
      submittedAt: new Date(),
      score: 0,
    };

    this.attempts.set(id, updated);
    return { ...updated };
  }
}