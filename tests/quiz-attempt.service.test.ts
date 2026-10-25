import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuizAttemptService } from '../src/modules/quiz-attempts/quiz-attempt.service.js';

import type {
  QuizAttemptRepository,
  QuizAttempt,
} from '../src/modules/quiz-attempts/quiz-attempt.repository.interface.js';
import type { QuizRepository } from '../src/modules/quizzes/quiz.repository.interface.js';
import type { EnrollmentRepository } from '../src/modules/enrollments/enrollment.repository.interface.js';

describe('QuizAttemptService', () => {
  let service: QuizAttemptService;
  let attempts: QuizAttemptRepository;
  let quizzes: QuizRepository;
  let enrollments: EnrollmentRepository;

  const quizId = 'quiz-123';
  const studentId = 'student-123';
  const attemptId = 'attempt-123';

  const quiz = {
    id: quizId,
    courseId: 'course-123',
    title: 'Test quiz',
    description: 'Test',
    durationMinutes: 30,
    maxMarks: 20,
    maxAttempts: 2,
    status: 'published' as const,
    startsAt: null,
    endsAt: null,
    resultsReleasedAt: null,
    showMarks: false,
    showCorrectAnswers: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const attempt: QuizAttempt = {
    id: attemptId,
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

  beforeEach(() => {
    attempts = {
      start: vi.fn().mockResolvedValue(attempt),
      findById: vi.fn(),
      countByQuizAndStudent: vi.fn().mockResolvedValue(0),
      findQuestions: vi.fn(),
      saveAnswer: vi.fn(),
      recordProctoringEvent: vi.fn(),
      findAnswersByAttemptId: vi.fn().mockResolvedValue([]),
      submit: vi.fn(),
    };

    quizzes = {
      findById: vi.fn().mockResolvedValue(quiz),
    } as unknown as QuizRepository;

    enrollments = {
      findByStudentAndCourse: vi.fn().mockResolvedValue({ id: 'enrollment-1' }),
    } as unknown as EnrollmentRepository;

    service = new QuizAttemptService(attempts, quizzes, enrollments);
  });

  describe('start', () => {
    it('starts an attempt when the quiz is available and the student is enrolled', async () => {
      await expect(service.start(quizId, studentId)).resolves.toEqual(attempt);

      expect(enrollments.findByStudentAndCourse).toHaveBeenCalledWith(
        studentId,
        quiz.courseId,
      );
      expect(attempts.start).toHaveBeenCalledWith(quizId, studentId);
      expect(attempts.countByQuizAndStudent).not.toHaveBeenCalled();
    });

    it('propagates the attempt limit error from the repository', async () => {
      vi.mocked(attempts.start).mockRejectedValue(
        new Error('MAX_ATTEMPTS_REACHED'),
      );

      await expect(service.start(quizId, studentId)).rejects.toThrow(
        'MAX_ATTEMPTS_REACHED',
      );

      expect(attempts.start).toHaveBeenCalledWith(quizId, studentId);
    });

    it('rejects a student who is not enrolled', async () => {
      vi.mocked(enrollments.findByStudentAndCourse).mockResolvedValue(
        undefined,
      );

      await expect(service.start(quizId, studentId)).rejects.toThrow(
        'NOT_ENROLLED',
      );

      expect(attempts.countByQuizAndStudent).not.toHaveBeenCalled();
      expect(attempts.start).not.toHaveBeenCalled();
    });
  });

  it('records a proctoring event for an active attempt', async () => {
    vi.mocked(attempts.findById).mockResolvedValue(attempt);
    vi.mocked(attempts.recordProctoringEvent).mockResolvedValue({
      ...attempt,
      tabSwitchCount: 1,
      suspiciousActivity: true,
    });

    await expect(
      service.recordProctoringEvent(
        {
          attemptId,
          type: 'tab_switch',
          metadata: 'Browser tab changed',
        },
        studentId,
      ),
    ).resolves.toMatchObject({
      tabSwitchCount: 1,
      suspiciousActivity: true,
    });

    expect(attempts.recordProctoringEvent).toHaveBeenCalledWith({
      attemptId,
      type: 'tab_switch',
      metadata: 'Browser tab changed',
    });
  });

  it('rejects proctoring events after submission', async () => {
    vi.mocked(attempts.findById).mockResolvedValue({
      ...attempt,
      status: 'submitted',
    });

    await expect(
      service.recordProctoringEvent(
        { attemptId, type: 'tab_switch' },
        studentId,
      ),
    ).rejects.toThrow('ATTEMPT_ALREADY_SUBMITTED');

    expect(attempts.recordProctoringEvent).not.toHaveBeenCalled();
  });

  it('rejects proctoring events for another student’s attempt', async () => {
    vi.mocked(attempts.findById).mockResolvedValue({
      ...attempt,
      studentId: 'another-student',
    });

    await expect(
      service.recordProctoringEvent(
        { attemptId, type: 'tab_switch' },
        studentId,
      ),
    ).rejects.toThrow('FORBIDDEN');

    expect(attempts.recordProctoringEvent).not.toHaveBeenCalled();
  });

  it('prevents a student from accessing another studentâ€™s attempt', async () => {
    vi.mocked(attempts.findById).mockResolvedValue({
      ...attempt,
      studentId: 'another-student',
    });

    await expect(service.getQuestions(attemptId, studentId)).rejects.toThrow(
      'FORBIDDEN',
    );

    expect(attempts.findQuestions).not.toHaveBeenCalled();
  });

  it('rejects saving answers after submission', async () => {
    vi.mocked(attempts.findById).mockResolvedValue({
      ...attempt,
      status: 'submitted',
    });

    await expect(
      service.saveAnswer(
        {
          attemptId,
          questionId: 'question-123',
          selectedOption: 'A',
        },
        studentId,
      ),
    ).rejects.toThrow('ATTEMPT_ALREADY_SUBMITTED');

    expect(attempts.saveAnswer).not.toHaveBeenCalled();
  });

  it('auto-submits an expired attempt when questions are requested', async () => {
    vi.mocked(attempts.findById).mockResolvedValue({
      ...attempt,
      startedAt: new Date(Date.now() - 31 * 60_000),
    });

    vi.mocked(attempts.submit).mockResolvedValue({
      ...attempt,
      status: 'auto_submitted',
      submittedAt: new Date(),
      score: 0,
    });

    await expect(service.getQuestions(attemptId, studentId)).rejects.toThrow(
      'QUIZ_TIME_EXPIRED',
    );

    expect(attempts.submit).toHaveBeenCalledWith(attemptId, 'auto_submitted');

    expect(attempts.findQuestions).not.toHaveBeenCalled();
  });

  it('returns an auto-submitted attempt after the deadline', async () => {
    vi.mocked(attempts.findById).mockResolvedValue({
      ...attempt,
      startedAt: new Date(Date.now() - 31 * 60_000),
    });

    vi.mocked(attempts.submit).mockResolvedValue({
      ...attempt,
      status: 'auto_submitted',
      submittedAt: new Date(),
      score: 0,
    });

    const result = await service.submit(attemptId, studentId);

    expect(result.status).toBe('auto_submitted');
    expect(result.score).toBeNull();

    expect(attempts.submit).toHaveBeenCalledWith(attemptId, 'auto_submitted');
  });

  it('hides the score when results have not been released', async () => {
    vi.mocked(attempts.findById).mockResolvedValue(attempt);

    vi.mocked(attempts.submit).mockResolvedValue({
      ...attempt,
      status: 'submitted',
      submittedAt: new Date(),
      score: 15,
    });

    vi.mocked(quizzes.findById).mockResolvedValue({
      ...quiz,
      resultsReleasedAt: null,
      showMarks: true,
    });

    const result = await service.submit(attemptId, studentId);

    expect(result.score).toBeNull();
  });

  it('hides the score when marks are disabled', async () => {
    vi.mocked(attempts.findById).mockResolvedValue(attempt);

    vi.mocked(attempts.submit).mockResolvedValue({
      ...attempt,
      status: 'submitted',
      submittedAt: new Date(),
      score: 15,
    });

    vi.mocked(quizzes.findById).mockResolvedValue({
      ...quiz,
      resultsReleasedAt: new Date(),
      showMarks: false,
    });

    const result = await service.submit(attemptId, studentId);

    expect(result.score).toBeNull();
  });

  it('shows the score when results are released and marks are enabled', async () => {
    vi.mocked(attempts.findById).mockResolvedValue(attempt);

    vi.mocked(attempts.submit).mockResolvedValue({
      ...attempt,
      status: 'submitted',
      submittedAt: new Date(),
      score: 15,
    });

    vi.mocked(quizzes.findById).mockResolvedValue({
      ...quiz,
      resultsReleasedAt: new Date(),
      showMarks: true,
    });

    const result = await service.submit(attemptId, studentId);

    expect(result.score).toBe(15);
  });

  it('rejects retrieving a result before submission', async () => {
    vi.mocked(attempts.findById).mockResolvedValue(attempt);

    await expect(service.getResult(attemptId, studentId)).rejects.toThrow(
      'ATTEMPT_NOT_SUBMITTED',
    );
  });

  it('hides the result score until results are released', async () => {
    vi.mocked(attempts.findById).mockResolvedValue({
      ...attempt,
      status: 'submitted',
      submittedAt: new Date(),
      score: 15,
    });

    vi.mocked(quizzes.findById).mockResolvedValue({
      ...quiz,
      resultsReleasedAt: null,
      showMarks: true,
    });

    const result = await service.getResult(attemptId, studentId);

    expect(result.score).toBeNull();
  });

  it('shows the result score when released and marks are enabled', async () => {
    vi.mocked(attempts.findById).mockResolvedValue({
      ...attempt,
      status: 'submitted',
      submittedAt: new Date(),
      score: 15,
    });

    vi.mocked(quizzes.findById).mockResolvedValue({
      ...quiz,
      resultsReleasedAt: new Date(),
      showMarks: true,
    });

    const result = await service.getResult(attemptId, studentId);

    expect(result.score).toBe(15);
  });
});
