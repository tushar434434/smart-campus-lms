import type {
  CreateQuizInput,
  CreateQuizQuestionInput,
  UpdateQuizInput,
  UpdateQuizQuestionInput,
} from './quiz.schema.js';

export type QuizStatus = 'draft' | 'published' | 'closed';
export type QuizOption = 'A' | 'B' | 'C' | 'D';

export interface Quiz {
  id: string;
  courseId: string;
  title: string;
  description: string;
  durationMinutes: number;
  maxMarks: number;
  maxAttempts: number;
  status: QuizStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  resultsReleasedAt: Date | null;
  showMarks: boolean;
  showCorrectAnswers: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: QuizOption;
  marks: number;
}

export type QuizQuestionForStudent = Omit<QuizQuestion, 'correctOption'> & {
  correctOption?: QuizOption;
};

export interface ReleaseQuizResultsInput {
  showMarks: boolean;
  showCorrectAnswers: boolean;
}

export interface QuizRepository {
  create(input: CreateQuizInput): Promise<Quiz>;
  findAllByCourseId(courseId: string): Promise<Quiz[]>;
  findById(id: string): Promise<Quiz | undefined>;
  update(id: string, input: UpdateQuizInput): Promise<Quiz | undefined>;
  countQuestions(id: string): Promise<number>;
  publish(id: string): Promise<Quiz | undefined>;
  releaseResults(
    id: string,
    input: ReleaseQuizResultsInput,
  ): Promise<Quiz | undefined>;
  delete(id: string): Promise<boolean>;

  createQuestion(
    quizId: string,
    input: CreateQuizQuestionInput,
  ): Promise<QuizQuestion | undefined>;

  findQuestionsByQuizId(quizId: string): Promise<QuizQuestion[]>;

  updateQuestion(
    quizId: string,
    questionId: string,
    input: UpdateQuizQuestionInput,
  ): Promise<QuizQuestion | undefined>;

  deleteQuestion(quizId: string, questionId: string): Promise<boolean>;
}
