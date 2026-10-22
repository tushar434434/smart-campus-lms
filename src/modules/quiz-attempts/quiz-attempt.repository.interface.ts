export type QuizAttemptStatus =
  'in_progress' | 'submitted' | 'auto_submitted' | 'flagged';

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
  selectedOption: 'A' | 'B' | 'C' | 'D';
}

export interface QuizAttemptRepository {
  start(quizId: string, studentId: string): Promise<QuizAttempt>;

  findById(id: string): Promise<QuizAttempt | undefined>;

  findQuestions(quizId: string): Promise<QuizQuestionForAttempt[]>;

  saveAnswer(input: QuizAnswerInput): Promise<void>;

  submit(id: string): Promise<QuizAttempt | undefined>;
}
