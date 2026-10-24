export type QuizAttemptStatus =
  'in_progress' | 'submitted' | 'auto_submitted' | 'flagged';

export type QuizOption = 'A' | 'B' | 'C' | 'D';

export interface QuizAttempt {
  id: string;
  quizId: string;
  studentId: string;
  startedAt: Date;
  submittedAt: Date | null;
  status: QuizAttemptStatus;
  score: number | null;
  tabSwitchCount: number;
  fullscreenExitCount: number;
  suspiciousActivity: boolean;
}

export interface QuizQuestionForAttempt {
  id: string;
  quizId: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  marks: number;
}

export interface QuizAnswerInput {
  attemptId: string;
  questionId: string;
  selectedOption: QuizOption;
}

export interface QuizAttemptAnswerResult {
  questionId: string;
  selectedOption: QuizOption;
  correctOption: QuizOption;
  marks: number;
  marksAwarded: number;
}

export interface QuizAttemptRepository {
  start(quizId: string, studentId: string): Promise<QuizAttempt>;

  findById(id: string): Promise<QuizAttempt | undefined>;

  countByQuizAndStudent(quizId: string, studentId: string): Promise<number>;

  findQuestions(quizId: string): Promise<QuizQuestionForAttempt[]>;

  saveAnswer(input: QuizAnswerInput): Promise<void>;

  findAnswersByAttemptId(attemptId: string): Promise<QuizAttemptAnswerResult[]>;

  submit(
    id: string,
    status?: 'submitted' | 'auto_submitted',
  ): Promise<QuizAttempt | undefined>;
}
