import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuizAttemptService } from '../src/modules/quiz-attempts/quiz-attempt.service.js';

import type {
  QuizAttemptRepository,
  QuizAttempt,
} from '../src/modules/quiz-attempts/quiz-attempt.repository.interface.js';
import type { QuizRepository } from '../src/modules/quizzes/quiz.repository.interface.js';
import type { EnrollmentRepository } from '../src/modules/enrollments/enrollment.repository.interface.js';
import type { CourseRepository } from '../src/modules/courses/course.repository.interface.js';
import type { StudentRepository } from '../src/modules/students/student.repository.interface.js';

describe('QuizAttemptService', () => {
  let service: QuizAttemptService;
  let attempts: QuizAttemptRepository;
  let quizzes: QuizRepository;
  let enrollments: EnrollmentRepository;
  let courses: CourseRepository;
  let students: StudentRepository;

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
      findByQuizId: vi.fn().mockResolvedValue([]),
      findByStudentId: vi.fn().mockResolvedValue([]),
      countByQuizAndStudent: vi.fn().mockResolvedValue(0),
      findQuestions: vi.fn(),
      saveAnswer: vi.fn(),
      setBookmark: vi.fn(),
      findBookmarkedQuestionIds: vi.fn().mockResolvedValue([]),
      recordProctoringEvent: vi.fn(),
      findAnswersByAttemptId: vi.fn().mockResolvedValue([]),
      submit: vi.fn(),
    };

    quizzes = {
      findById: vi.fn().mockResolvedValue(quiz),
    } as unknown as QuizRepository;

    enrollments = {
      findByStudentAndCourse: vi.fn().mockResolvedValue({
        id: 'enrollment-1',
        status: 'approved',
      }),
      findAllByCourseId: vi.fn().mockResolvedValue([]),
    } as unknown as EnrollmentRepository;

    courses = {
      findById: vi.fn().mockResolvedValue({
        id: 'course-123',
        ownerFacultyId: 'faculty-123',
        approvalStatus: 'approved',
        title: 'Test course',
      }),
    } as unknown as CourseRepository;
    students = {
      findById: vi.fn().mockResolvedValue({
        id: studentId,
        name: 'Test student',
        email: 'student@example.com',
        enrollmentNumber: 'SC2026-000001',
      }),
    } as unknown as StudentRepository;

    service = new QuizAttemptService(
      attempts,
      quizzes,
      enrollments,
      courses,
      students,
    );
  });

  it('returns student activity with hidden marks and numbered attempts', async () => {
    const earlierAttempt = {
      ...attempt,
      id: 'attempt-earlier',
      startedAt: new Date(1),
    };
    const laterAttempt = {
      ...attempt,
      id: 'attempt-later',
      score: 18,
      startedAt: new Date(2),
    };
    vi.mocked(attempts.findByStudentId).mockResolvedValue([
      laterAttempt,
      earlierAttempt,
    ]);

    await expect(service.getStudentActivity(studentId)).resolves.toEqual([
      expect.objectContaining({
        id: 'attempt-later',
        score: null,
        attemptNumber: 2,
        remainingAttempts: 0,
        quizTitle: quiz.title,
        courseTitle: 'Test course',
      }),
      expect.objectContaining({
        id: 'attempt-earlier',
        attemptNumber: 1,
      }),
    ]);
  });

  it('returns an enrolled class roster only to the owning faculty member', async () => {
    vi.mocked(enrollments.findAllByCourseId).mockResolvedValue([
      {
        id: 'enrollment-1',
        studentId,
        courseId: quiz.courseId,
        status: 'approved',
        enrolledAt: new Date(),
      },
    ] as never);
    vi.mocked(attempts.findByQuizId).mockResolvedValue([attempt]);

    const roster = await service.getQuizRoster(quizId, {
      sub: 'faculty-123',
      role: 'faculty',
    });

    expect(roster).toEqual([
      expect.objectContaining({
        student: expect.objectContaining({ id: studentId }),
        attemptCount: 1,
        status: 'in_progress',
      }),
    ]);
    await expect(
      service.getQuizRoster(quizId, { sub: 'other-faculty', role: 'faculty' }),
    ).rejects.toThrow('FORBIDDEN');
  });

  it('hydrates an active attempt with saved answers and bookmarks without answer keys', async () => {
    vi.mocked(attempts.findById).mockResolvedValue(attempt);
    vi.mocked(attempts.findQuestions).mockResolvedValue([
      {
        id: 'question-1',
        quizId,
        questionText: 'Question text',
        optionA: 'A',
        optionB: 'B',
        optionC: 'C',
        optionD: 'D',
        marks: 1,
      },
    ]);
    vi.mocked(attempts.findAnswersByAttemptId).mockResolvedValue([
      {
        questionId: 'question-1',
        selectedOption: 'B',
        correctOption: 'B',
        marks: 1,
        marksAwarded: 1,
      },
    ]);
    vi.mocked(attempts.findBookmarkedQuestionIds).mockResolvedValue([
      'question-1',
    ]);

    const questions = await service.getQuestions(attemptId, studentId);
    expect(questions[0]).toMatchObject({
      selectedOption: 'B',
      bookmarked: true,
    });
    expect(questions[0]).not.toHaveProperty('correctOption');
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

    it('rejects a student whose enrollment is still pending', async () => {
      vi.mocked(enrollments.findByStudentAndCourse).mockResolvedValue({
        id: 'enrollment-pending',
        status: 'pending',
      } as never);

      await expect(service.start(quizId, studentId)).rejects.toThrow(
        'NOT_ENROLLED',
      );
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

  it('rejects proctoring events for another student�s attempt', async () => {
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

  it('prevents a student from accessing another student’s attempt', async () => {
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
