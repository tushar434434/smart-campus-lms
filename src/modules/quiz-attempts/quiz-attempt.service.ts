import type { QuizRepository } from '../quizzes/quiz.repository.interface.js';
import type { EnrollmentRepository } from '../enrollments/enrollment.repository.interface.js';
import type {
  QuizAttempt,
  QuizAttemptRepository,
  QuizAnswerInput,
} from './quiz-attempt.repository.interface.js';

export class QuizAttemptService {
  constructor(
    private readonly attemptRepository: QuizAttemptRepository,
    private readonly quizRepository: QuizRepository,
    private readonly enrollmentRepository: EnrollmentRepository,
  ) {}

  async start(quizId: string, studentId: string): Promise<QuizAttempt> {
    const quiz = await this.quizRepository.findById(quizId);

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

    if (quiz.endsAt && now >= quiz.endsAt) {
      throw new Error('QUIZ_ENDED');
    }

    const enrollment = await this.enrollmentRepository.findByStudentAndCourse(
      studentId,
      quiz.courseId,
    );

    if (!enrollment) {
      throw new Error('NOT_ENROLLED');
    }

    return this.attemptRepository.start(quizId, studentId);
  }

  async getQuestions(attemptId: string, studentId: string) {
    const attempt = await this.requireOwnedAttempt(attemptId, studentId);

    if (attempt.status !== 'in_progress') {
      throw new Error('ATTEMPT_ALREADY_SUBMITTED');
    }

    await this.ensureWithinDuration(attempt);

    return this.attemptRepository.findQuestions(attempt.quizId);
  }

  async saveAnswer(input: QuizAnswerInput, studentId: string): Promise<void> {
    const attempt = await this.requireOwnedAttempt(input.attemptId, studentId);

    if (attempt.status !== 'in_progress') {
      throw new Error('ATTEMPT_ALREADY_SUBMITTED');
    }

    await this.ensureWithinDuration(attempt);
    await this.attemptRepository.saveAnswer(input);
  }

  async submit(attemptId: string, studentId: string): Promise<QuizAttempt> {
    const attempt = await this.requireOwnedAttempt(attemptId, studentId);

    if (attempt.status !== 'in_progress') {
      return attempt;
    }

    if (await this.isExpired(attempt)) {
      const autoSubmitted = await this.attemptRepository.submit(
        attemptId,
        'auto_submitted',
      );

      if (!autoSubmitted) {
        throw new Error('ATTEMPT_NOT_FOUND');
      }

      return autoSubmitted;
    }

    const submitted = await this.attemptRepository.submit(
      attemptId,
      'submitted',
    );

    if (!submitted) {
      throw new Error('ATTEMPT_NOT_FOUND');
    }

    return submitted;
  }

  private async requireOwnedAttempt(
    attemptId: string,
    studentId: string,
  ): Promise<QuizAttempt> {
    const attempt = await this.attemptRepository.findById(attemptId);

    if (!attempt) {
      throw new Error('ATTEMPT_NOT_FOUND');
    }

    if (attempt.studentId !== studentId) {
      throw new Error('FORBIDDEN');
    }

    return attempt;
  }

  private async isExpired(attempt: QuizAttempt): Promise<boolean> {
    const quiz = await this.quizRepository.findById(attempt.quizId);

    if (!quiz) {
      throw new Error('QUIZ_NOT_FOUND');
    }

    const durationDeadline =
      attempt.startedAt.getTime() + quiz.durationMinutes * 60_000;

    const now = Date.now();

    return (
      now >= durationDeadline ||
      (quiz.endsAt !== null && now >= quiz.endsAt.getTime())
    );
  }

  private async ensureWithinDuration(attempt: QuizAttempt): Promise<void> {
    if (await this.isExpired(attempt)) {
      await this.attemptRepository.submit(attempt.id, 'auto_submitted');

      throw new Error('QUIZ_TIME_EXPIRED');
    }
  }
}
