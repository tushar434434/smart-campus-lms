import { AppError } from '../../errors/app-error.js';
import type { CourseRepository } from '../courses/course.repository.interface.js';

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
  role: 'admin' | 'faculty' | 'student';
};

export class QuizService {
  constructor(
    private readonly quizRepository: QuizRepository,
    private readonly courseRepository: CourseRepository,
  ) {}

  async create(input: CreateQuizInput): Promise<Quiz> {
    const course = await this.courseRepository.findById(input.courseId);

    if (!course) {
      throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
    }

    return this.quizRepository.create(input);
  }

  async getAllByCourseId(courseId: string, user: QuizReader): Promise<Quiz[]> {
    const course = await this.courseRepository.findById(courseId);

    if (!course) {
      throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
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

    return user.role === 'student' ? this.forStudent(quiz) : quiz;
  }

  async update(id: string, input: UpdateQuizInput): Promise<Quiz> {
    const quiz = await this.quizRepository.update(id, input);

    if (!quiz) {
      throw new AppError('Quiz not found', 404, 'QUIZ_NOT_FOUND');
    }

    return quiz;
  }

  async publish(id: string): Promise<Quiz> {
    const quiz = await this.quizRepository.findById(id);

    if (!quiz) {
      throw new AppError('Quiz not found', 404, 'QUIZ_NOT_FOUND');
    }

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
  ): Promise<Quiz> {
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
  ): Promise<QuizQuestion> {
    const quiz = await this.quizRepository.findById(quizId);

    if (!quiz) {
      throw new AppError('Quiz not found', 404, 'QUIZ_NOT_FOUND');
    }

    if (quiz.status !== 'draft') {
      throw new AppError(
        'Questions can only be added to draft quizzes',
        409,
        'QUIZ_NOT_EDITABLE',
      );
    }

    const question = await this.quizRepository.createQuestion(quizId, input);

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
  ): Promise<QuizQuestion> {
    const quiz = await this.quizRepository.findById(quizId);

    if (!quiz) {
      throw new AppError('Quiz not found', 404, 'QUIZ_NOT_FOUND');
    }

    if (quiz.status !== 'draft') {
      throw new AppError(
        'Questions can only be changed in draft quizzes',
        409,
        'QUIZ_NOT_EDITABLE',
      );
    }

    const question = await this.quizRepository.updateQuestion(
      quizId,
      questionId,
      input,
    );

    if (!question) {
      throw new AppError('Question not found', 404, 'QUESTION_NOT_FOUND');
    }

    return question;
  }

  async deleteQuestion(quizId: string, questionId: string): Promise<void> {
    const quiz = await this.quizRepository.findById(quizId);

    if (!quiz) {
      throw new AppError('Quiz not found', 404, 'QUIZ_NOT_FOUND');
    }

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

  private forStudent(quiz: Quiz): Quiz {
    return {
      ...quiz,
      showMarks: quiz.resultsReleasedAt !== null && quiz.showMarks,
      showCorrectAnswers:
        quiz.resultsReleasedAt !== null && quiz.showCorrectAnswers,
    };
  }
}
