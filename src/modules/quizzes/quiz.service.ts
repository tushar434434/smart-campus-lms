import { AppError } from '../../errors/app-error.js';
import type { CourseRepository } from '../courses/course.repository.interface.js';
import type {
  CreateQuizInput,
  UpdateQuizInput,
  ReleaseQuizResultsInput,
} from './quiz.schema.js';
import type { Quiz, QuizRepository } from './quiz.repository.interface.js';

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

    if (user.role !== 'student') {
      return quizzes;
    }

    return quizzes
      .filter((quiz) => quiz.status === 'published')
      .map((quiz) => this.forStudent(quiz));
  }

  async getById(id: string, user: QuizReader): Promise<Quiz> {
    const quiz = await this.quizRepository.findById(id);

    if (!quiz) {
      throw new AppError('Quiz not found', 404, 'QUIZ_NOT_FOUND');
    }

    if (user.role === 'student' && quiz.status !== 'published') {
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
    const deleted = await this.quizRepository.delete(id);

    if (!deleted) {
      throw new AppError('Quiz not found', 404, 'QUIZ_NOT_FOUND');
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
