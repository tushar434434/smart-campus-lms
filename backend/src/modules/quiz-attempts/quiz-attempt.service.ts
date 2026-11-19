import type { QuizRepository } from '../quizzes/quiz.repository.interface.js';
import type { EnrollmentRepository } from '../enrollments/enrollment.repository.interface.js';
import type { CourseRepository } from '../courses/course.repository.interface.js';
import type { StudentRepository } from '../students/student.repository.interface.js';
import type {
  QuizAttempt,
  QuizAttemptRepository,
  QuizAnswerInput,
  ProctoringEventInput,
} from './quiz-attempt.repository.interface.js';

export class QuizAttemptService {
  constructor(
    private readonly attemptRepository: QuizAttemptRepository,
    private readonly quizRepository: QuizRepository,
    private readonly enrollmentRepository: EnrollmentRepository,
    private readonly courseRepository: CourseRepository,
    private readonly studentRepository: StudentRepository,
  ) {}

  async getStudentActivity(studentId: string) {
    const attempts = await this.attemptRepository.findByStudentId(studentId);
    const quizzes = new Map(
      await Promise.all(
        [...new Set(attempts.map((attempt) => attempt.quizId))].map(
          async (quizId) => {
            const quiz = await this.quizRepository.findById(quizId);
            if (!quiz) throw new Error('QUIZ_NOT_FOUND');
            const course = await this.courseRepository.findById(quiz.courseId);
            if (!course) throw new Error('COURSE_NOT_FOUND');
            return [quizId, { quiz, course }] as const;
          },
        ),
      ),
    );
    const counts = new Map<string, number>();
    for (const attempt of attempts) {
      counts.set(attempt.quizId, (counts.get(attempt.quizId) ?? 0) + 1);
    }

    return Promise.all(
      attempts.map(async (attempt) => {
        const quizData = quizzes.get(attempt.quizId);
        if (!quizData) throw new Error('QUIZ_NOT_FOUND');
        const { quiz, course } = quizData;
        const sameQuiz = attempts
          .filter((candidate) => candidate.quizId === attempt.quizId)
          .sort(
            (left, right) =>
              left.startedAt.getTime() - right.startedAt.getTime(),
          );
        const attemptNumber =
          sameQuiz.findIndex((candidate) => candidate.id === attempt.id) + 1;
        const scoreVisible = quiz.resultsReleasedAt !== null && quiz.showMarks;

        return {
          ...attempt,
          score: scoreVisible ? attempt.score : null,
          quizTitle: quiz.title,
          courseTitle: course.title,
          attemptNumber,
          remainingAttempts: Math.max(
            0,
            quiz.maxAttempts - (counts.get(attempt.quizId) ?? 0),
          ),
        };
      }),
    );
  }

  async getQuizRoster(
    quizId: string,
    user: { sub: string; role: 'student' | 'faculty' | 'admin' },
  ) {
    if (user.role === 'student') {
      throw new Error('FORBIDDEN');
    }
    const quiz = await this.quizRepository.findById(quizId);
    if (!quiz) throw new Error('QUIZ_NOT_FOUND');
    const course = await this.courseRepository.findById(quiz.courseId);
    if (!course) throw new Error('COURSE_NOT_FOUND');
    if (user.role !== 'admin' && course.ownerFacultyId !== user.sub) {
      throw new Error('FORBIDDEN');
    }

    const [enrollments, attempts] = await Promise.all([
      this.enrollmentRepository.findAllByCourseId(quiz.courseId),
      this.attemptRepository.findByQuizId(quizId),
    ]);
    const approvedEnrollments = enrollments.filter(
      (enrollment) => enrollment.status === 'approved',
    );
    const attemptsByStudent = new Map<string, QuizAttempt[]>();
    for (const attempt of attempts) {
      const current = attemptsByStudent.get(attempt.studentId) ?? [];
      current.push(attempt);
      attemptsByStudent.set(attempt.studentId, current);
    }

    return Promise.all(
      approvedEnrollments.map(async (enrollment) => {
        const student = await this.studentRepository.findById(
          enrollment.studentId,
        );
        if (!student) throw new Error('STUDENT_NOT_FOUND');
        const studentAttempts = (attemptsByStudent.get(student.id) ?? []).sort(
          (left, right) => left.startedAt.getTime() - right.startedAt.getTime(),
        );
        const latestAttempt =
          studentAttempts[studentAttempts.length - 1] ?? null;

        return {
          student: {
            id: student.id,
            name: student.name,
            email: student.email,
            enrollmentNumber: student.enrollmentNumber,
          },
          attemptCount: studentAttempts.length,
          remainingAttempts: Math.max(
            0,
            quiz.maxAttempts - studentAttempts.length,
          ),
          status: latestAttempt?.status ?? 'not_attempted',
          latestAttempt,
          attempts: studentAttempts,
        };
      }),
    );
  }

  async start(quizId: string, studentId: string): Promise<QuizAttempt> {
    const quiz = await this.quizRepository.findById(quizId);

    if (!quiz) {
      throw new Error('QUIZ_NOT_FOUND');
    }

    if (quiz.status !== 'published') {
      throw new Error('QUIZ_NOT_AVAILABLE');
    }

    const course = await this.courseRepository.findById(quiz.courseId);
    if (!course || course.approvalStatus !== 'approved') {
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

    if (!enrollment || enrollment.status !== 'approved') {
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

    const [questions, answers, bookmarks] = await Promise.all([
      this.attemptRepository.findQuestions(attempt.quizId),
      this.attemptRepository.findAnswersByAttemptId(attemptId),
      this.attemptRepository.findBookmarkedQuestionIds(attemptId),
    ]);
    const answersByQuestion = new Map(
      answers.map((answer) => [answer.questionId, answer.selectedOption]),
    );
    const bookmarked = new Set(bookmarks);
    return questions.map((question) => ({
      ...question,
      ...(answersByQuestion.has(question.id) && {
        selectedOption: answersByQuestion.get(question.id),
      }),
      bookmarked: bookmarked.has(question.id),
    }));
  }

  async bookmarkQuestion(
    attemptId: string,
    questionId: string,
    bookmarked: boolean,
    studentId: string,
  ): Promise<void> {
    const attempt = await this.requireOwnedAttempt(attemptId, studentId);
    if (attempt.status !== 'in_progress') {
      throw new Error('ATTEMPT_ALREADY_SUBMITTED');
    }
    await this.ensureWithinDuration(attempt);
    await this.attemptRepository.setBookmark(attemptId, questionId, bookmarked);
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
      return this.hideScoreUnlessReleased(attempt);
    }

    if (await this.isExpired(attempt)) {
      const autoSubmitted = await this.attemptRepository.submit(
        attemptId,
        'auto_submitted',
      );

      if (!autoSubmitted) {
        throw new Error('ATTEMPT_NOT_FOUND');
      }

      return this.hideScoreUnlessReleased(autoSubmitted);
    }

    const submitted = await this.attemptRepository.submit(
      attemptId,
      'submitted',
    );

    if (!submitted) {
      throw new Error('ATTEMPT_NOT_FOUND');
    }

    return this.hideScoreUnlessReleased(submitted);
  }

  async recordProctoringEvent(
    input: ProctoringEventInput,
    studentId: string,
  ): Promise<QuizAttempt> {
    const attempt = await this.requireOwnedAttempt(input.attemptId, studentId);

    if (attempt.status !== 'in_progress') {
      throw new Error('ATTEMPT_ALREADY_SUBMITTED');
    }

    await this.ensureWithinDuration(attempt);

    return this.attemptRepository.recordProctoringEvent(input);
  }
  async getResult(attemptId: string, studentId: string): Promise<QuizAttempt> {
    const attempt = await this.requireOwnedAttempt(attemptId, studentId);

    if (attempt.status === 'in_progress') {
      throw new Error('ATTEMPT_NOT_SUBMITTED');
    }

    return this.hideScoreUnlessReleased(attempt);
  }
  private async hideScoreUnlessReleased(
    attempt: QuizAttempt,
  ): Promise<QuizAttempt> {
    const quiz = await this.quizRepository.findById(attempt.quizId);

    if (!quiz) {
      throw new Error('QUIZ_NOT_FOUND');
    }

    const canViewMarks = quiz.resultsReleasedAt !== null && quiz.showMarks;

    if (!canViewMarks) {
      return { ...attempt, score: null };
    }

    return attempt;
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
