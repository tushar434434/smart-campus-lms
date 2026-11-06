import { AppError } from '../../errors/app-error.js';
import type { CourseRepository } from '../courses/course.repository.interface.js';
import type { EnrollmentRepository } from '../enrollments/enrollment.repository.interface.js';
import type { AuthRepository } from '../auth/auth.repository.interface.js';
import type { StudentRepository } from '../students/student.repository.interface.js';
import { resolveStudentForUser } from '../students/student.service.js';
import {
  InMemoryCourseMaterialFileStorage,
  validateCourseMaterialFile,
  type CourseMaterialFileStorage,
} from '../courses/course-material-file-storage.js';
import type { QuizQuestionImageSlot } from './quiz.repository.interface.js';

import type {
  CreateQuizInput,
  CreateQuizQuestionInput,
  UpdateQuizInput,
  UpdateQuizQuestionInput,
  ReleaseQuizResultsInput,
} from './quiz.schema.js';

import type {
  Quiz,
  QuizQuestion,
  QuizQuestionForStudent,
  QuizRepository,
} from './quiz.repository.interface.js';

type QuizReader = {
  sub: string;
  role: 'admin' | 'faculty' | 'student';
};

export class QuizService {
  constructor(
    private readonly quizRepository: QuizRepository,
    private readonly courseRepository: CourseRepository,
    private readonly enrollmentRepository: EnrollmentRepository,
    private readonly studentRepository: StudentRepository,
    private readonly authRepository?: AuthRepository,
    private readonly imageStorage: CourseMaterialFileStorage = new InMemoryCourseMaterialFileStorage(),
  ) {}

  private async requireApprovedStudentEnrollment(
    courseId: string,
    user: QuizReader,
  ): Promise<void> {
    const course = await this.courseRepository.findById(courseId);
    if (!course || course.approvalStatus !== 'approved') {
      throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
    }
    const student = await resolveStudentForUser(
      user.sub,
      this.studentRepository,
      this.authRepository,
    );
    if (!student) {
      throw new AppError(
        'Student account is not linked',
        403,
        'STUDENT_NOT_LINKED',
      );
    }
    const enrollment = await this.enrollmentRepository.findByStudentAndCourse(
      student.id,
      courseId,
    );
    if (!enrollment || enrollment.status !== 'approved') {
      throw new AppError(
        'Approved enrollment is required',
        403,
        'NOT_ENROLLED',
      );
    }
  }

  async create(input: CreateQuizInput, user: QuizReader): Promise<Quiz> {
    const course = await this.courseRepository.findById(input.courseId);

    if (!course) {
      throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
    }
    this.requireCourseManager(course.ownerFacultyId, user);

    return this.quizRepository.create(input);
  }

  async getAllByCourseId(courseId: string, user: QuizReader): Promise<Quiz[]> {
    const course = await this.courseRepository.findById(courseId);

    if (!course) {
      throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
    }
    if (user.role !== 'student') {
      this.requireCourseManager(course.ownerFacultyId, user);
    } else {
      await this.requireApprovedStudentEnrollment(courseId, user);
    }

    const quizzes = await this.quizRepository.findAllByCourseId(courseId);

    if (user.role !== 'student') return quizzes;

    return quizzes
      .filter((quiz) => quiz.status === 'published')
      .map((quiz) => this.forStudent(quiz));
  }

  async getById(id: string, user: QuizReader): Promise<Quiz> {
    const quiz = await this.quizRepository.findById(id);

    if (!quiz || (user.role === 'student' && quiz.status !== 'published')) {
      throw new AppError('Quiz not found', 404, 'QUIZ_NOT_FOUND');
    }
    if (user.role === 'student') {
      await this.requireApprovedStudentEnrollment(quiz.courseId, user);
    }
    if (user.role !== 'student') {
      await this.requireQuizManager(quiz, user);
    }

    return user.role === 'student' ? this.forStudent(quiz) : quiz;
  }

  async update(
    id: string,
    input: UpdateQuizInput,
    user: QuizReader,
  ): Promise<Quiz> {
    const existing = await this.requireQuiz(id);
    await this.requireQuizManager(existing, user);
    const quiz = await this.quizRepository.update(id, input);

    if (!quiz) {
      throw new AppError('Quiz not found', 404, 'QUIZ_NOT_FOUND');
    }

    return quiz;
  }

  async publish(id: string, user: QuizReader): Promise<Quiz> {
    const quiz = await this.requireQuiz(id);
    await this.requireQuizManager(quiz, user);

    if ((await this.quizRepository.countQuestions(id)) === 0) {
      throw new AppError(
        'Cannot publish a quiz without questions',
        400,
        'QUIZ_HAS_NO_QUESTIONS',
      );
    }

    const publishedQuiz = await this.quizRepository.publish(id);

    if (!publishedQuiz) {
      throw new AppError('Quiz not found', 404, 'QUIZ_NOT_FOUND');
    }

    return publishedQuiz;
  }

  async releaseResults(
    id: string,
    input: ReleaseQuizResultsInput,
    user: QuizReader,
  ): Promise<Quiz> {
    const existing = await this.requireQuiz(id);
    await this.requireQuizManager(existing, user);
    const quiz = await this.quizRepository.releaseResults(id, input);

    if (!quiz) {
      throw new AppError('Quiz not found', 404, 'QUIZ_NOT_FOUND');
    }

    return quiz;
  }

  async delete(id: string): Promise<void> {
    if (!(await this.quizRepository.delete(id))) {
      throw new AppError('Quiz not found', 404, 'QUIZ_NOT_FOUND');
    }
  }

  async createQuestion(
    quizId: string,
    input: CreateQuizQuestionInput,
    user: QuizReader,
  ): Promise<QuizQuestion> {
    const quiz = await this.requireQuiz(quizId);
    await this.requireQuizManager(quiz, user);

    if (quiz.status !== 'draft') {
      throw new AppError(
        'Questions can only be added to draft quizzes',
        409,
        'QUIZ_NOT_EDITABLE',
      );
    }

    if (
      input.questionType === 'true_false' &&
      !['A', 'B'].includes(input.correctOption)
    ) {
      throw new AppError(
        'True/False answers must use option A or B',
        400,
        'INVALID_CORRECT_OPTION',
      );
    }

    const question = await this.quizRepository.createQuestion(
      quizId,
      input.questionType === 'true_false'
        ? {
            ...input,
            optionA: 'True',
            optionB: 'False',
            optionC: '',
            optionD: '',
          }
        : input,
    );

    if (!question) {
      throw new AppError('Quiz not found', 404, 'QUIZ_NOT_FOUND');
    }

    return question;
  }

  async getQuestions(
    quizId: string,
    user: QuizReader,
  ): Promise<Array<QuizQuestion | QuizQuestionForStudent>> {
    const quiz = await this.quizRepository.findById(quizId);

    if (!quiz || (user.role === 'student' && quiz.status !== 'published')) {
      throw new AppError('Quiz not found', 404, 'QUIZ_NOT_FOUND');
    }
    if (user.role === 'student') {
      await this.requireApprovedStudentEnrollment(quiz.courseId, user);
    }
    if (user.role !== 'student') {
      await this.requireQuizManager(quiz, user);
    }

    const questions = await this.quizRepository.findQuestionsByQuizId(quizId);

    if (user.role !== 'student') return questions;

    const canSeeCorrectAnswers =
      quiz.resultsReleasedAt !== null && quiz.showCorrectAnswers;

    if (canSeeCorrectAnswers) return questions;

    return questions.map((question) => {
      const { correctOption, ...safeQuestion } = question;
      void correctOption;
      return safeQuestion;
    });
  }

  async updateQuestion(
    quizId: string,
    questionId: string,
    input: UpdateQuizQuestionInput,
    user: QuizReader,
  ): Promise<QuizQuestion> {
    const quiz = await this.requireQuiz(quizId);
    await this.requireQuizManager(quiz, user);

    if (quiz.status !== 'draft') {
      throw new AppError(
        'Questions can only be changed in draft quizzes',
        409,
        'QUIZ_NOT_EDITABLE',
      );
    }

    const existing = (
      await this.quizRepository.findQuestionsByQuizId(quizId)
    ).find((item) => item.id === questionId);
    if (!existing) {
      throw new AppError('Question not found', 404, 'QUESTION_NOT_FOUND');
    }
    const nextType = input.questionType ?? existing.questionType;
    if (
      nextType === 'true_false' &&
      input.correctOption &&
      !['A', 'B'].includes(input.correctOption)
    ) {
      throw new AppError(
        'True/False answers must use option A or B',
        400,
        'INVALID_CORRECT_OPTION',
      );
    }

    const question = await this.quizRepository.updateQuestion(
      quizId,
      questionId,
      nextType === 'true_false'
        ? {
            ...input,
            questionType: nextType,
            optionA: 'True',
            optionB: 'False',
            optionC: '',
            optionD: '',
          }
        : input,
    );

    if (!question) {
      throw new AppError('Question not found', 404, 'QUESTION_NOT_FOUND');
    }

    return question;
  }

  async deleteQuestion(
    quizId: string,
    questionId: string,
    user: QuizReader,
  ): Promise<void> {
    const quiz = await this.requireQuiz(quizId);
    await this.requireQuizManager(quiz, user);

    if (quiz.status !== 'draft') {
      throw new AppError(
        'Questions can only be deleted from draft quizzes',
        409,
        'QUIZ_NOT_EDITABLE',
      );
    }

    const deleted = await this.quizRepository.deleteQuestion(
      quizId,
      questionId,
    );

    if (!deleted) {
      throw new AppError('Question not found', 404, 'QUESTION_NOT_FOUND');
    }
  }

  async uploadQuestionImage(
    quizId: string,
    questionId: string,
    slot: QuizQuestionImageSlot,
    buffer: Buffer,
    mimeType: string,
    originalFileName: string,
    user: QuizReader,
  ) {
    const quiz = await this.requireQuiz(quizId);
    await this.requireQuizManager(quiz, user);
    if (quiz.status !== 'draft') {
      throw new AppError(
        'Images can only be changed on draft quizzes',
        409,
        'QUIZ_NOT_EDITABLE',
      );
    }
    const question = (
      await this.quizRepository.findQuestionsByQuizId(quizId)
    ).find((item) => item.id === questionId);
    if (!question) {
      throw new AppError('Question not found', 404, 'QUESTION_NOT_FOUND');
    }
    if (!mimeType.startsWith('image/')) {
      throw new AppError(
        'Question images must be JPEG, PNG, or WebP',
        400,
        'INVALID_FILE_TYPE',
      );
    }
    let validatedMimeType;
    try {
      validatedMimeType = validateCourseMaterialFile(buffer, mimeType);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      throw new AppError(
        code === 'MATERIAL_FILE_TOO_LARGE'
          ? 'Question images cannot exceed 10 MiB'
          : 'Question image content does not match an allowed image format',
        code === 'MATERIAL_FILE_TOO_LARGE' ? 413 : 400,
        code === 'MATERIAL_FILE_TOO_LARGE'
          ? 'FILE_TOO_LARGE'
          : 'INVALID_FILE_CONTENT',
      );
    }
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(validatedMimeType)
    ) {
      throw new AppError(
        'Question images must be JPEG, PNG, or WebP',
        400,
        'INVALID_FILE_TYPE',
      );
    }
    const previous = await this.quizRepository.findQuestionImage(
      questionId,
      slot,
    );
    const fileKey = await this.imageStorage.save(buffer, validatedMimeType);
    try {
      const image = await this.quizRepository.attachQuestionImage({
        questionId,
        slot,
        fileKey,
        mimeType: validatedMimeType,
        size: buffer.byteLength,
        originalFileName: originalFileName.slice(0, 255),
      });
      if (previous) await this.imageStorage.remove(previous.fileKey);
      return {
        slot: image.slot,
        mimeType: image.mimeType,
        size: image.size,
        originalFileName: image.originalFileName,
      };
    } catch (error) {
      await this.imageStorage.remove(fileKey);
      throw error;
    }
  }

  async getQuestionImage(
    quizId: string,
    questionId: string,
    slot: QuizQuestionImageSlot,
    user: QuizReader,
  ) {
    await this.getById(quizId, user);
    const question = (
      await this.quizRepository.findQuestionsByQuizId(quizId)
    ).find((item) => item.id === questionId);
    if (!question) {
      throw new AppError('Question not found', 404, 'QUESTION_NOT_FOUND');
    }
    const image = await this.quizRepository.findQuestionImage(questionId, slot);
    if (!image) {
      throw new AppError(
        'Question image not found',
        404,
        'QUESTION_IMAGE_NOT_FOUND',
      );
    }
    return {
      buffer: await this.imageStorage.read(image.fileKey),
      mimeType: image.mimeType,
      fileName: image.originalFileName,
    };
  }

  private forStudent(quiz: Quiz): Quiz {
    return {
      ...quiz,
      showMarks: quiz.resultsReleasedAt !== null && quiz.showMarks,
      showCorrectAnswers:
        quiz.resultsReleasedAt !== null && quiz.showCorrectAnswers,
    };
  }

  private async requireQuiz(id: string): Promise<Quiz> {
    const quiz = await this.quizRepository.findById(id);
    if (!quiz) {
      throw new AppError('Quiz not found', 404, 'QUIZ_NOT_FOUND');
    }
    return quiz;
  }

  private async requireQuizManager(
    quiz: Quiz,
    user: QuizReader,
  ): Promise<void> {
    const course = await this.courseRepository.findById(quiz.courseId);
    if (!course) {
      throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
    }
    this.requireCourseManager(course.ownerFacultyId, user);
  }

  private requireCourseManager(
    ownerFacultyId: string | null,
    user: QuizReader,
  ): void {
    if (
      user.role !== 'admin' &&
      (user.role !== 'faculty' || ownerFacultyId !== user.sub)
    ) {
      throw new AppError(
        'You can only manage quizzes for courses assigned to you',
        403,
        'FORBIDDEN',
      );
    }
  }
}
