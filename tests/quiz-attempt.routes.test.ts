import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../src/app.js';
import type { QuizAttemptService } from '../src/modules/quiz-attempts/quiz-attempt.service.js';

const USER_ID = 'user-123';
const STUDENT_ID = 'student-123';
const OTHER_USER_ID = 'another-user-456';
const OTHER_STUDENT_ID = 'another-student-456';

const QUIZ_ID = '11111111-1111-4111-8111-111111111111';
const ATTEMPT_ID = '22222222-2222-4222-8222-222222222222';
const QUESTION_ID = '33333333-3333-4333-8333-333333333333';

function makeAttempt(overrides: Record<string, unknown> = {}) {
  return {
    id: ATTEMPT_ID,
    quizId: QUIZ_ID,
    studentId: STUDENT_ID,
    startedAt: new Date(),
    submittedAt: null,
    status: 'in_progress',
    score: null,
    tabSwitchCount: 0,
    fullscreenExitCount: 0,
    suspiciousActivity: false,
    ...overrides,
  };
}

describe('Quiz attempt routes', () => {
  let app: FastifyInstance;

  const service = {
    start: vi.fn(),
    getQuestions: vi.fn(),
    saveAnswer: vi.fn(),
    recordProctoringEvent: vi.fn(),
    submit: vi.fn(),
    getResult: vi.fn(),
  };

  const studentRepository = {
    findByUserId: vi.fn().mockResolvedValue({ id: STUDENT_ID }),
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';

    app = buildApp({
      prisma: {
        $queryRaw: async () => [],
        $disconnect: async () => undefined,
      },
      courseService: {} as never,
      studentService: {} as never,
      studentRepository: studentRepository as never,
      enrollmentService: {} as never,
      assignmentService: {} as never,
      submissionService: {} as never,
      authService: {} as never,
      quizService: {} as never,
      quizAttemptService: service as unknown as QuizAttemptService,
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    studentRepository.findByUserId.mockResolvedValue({ id: STUDENT_ID });
  });

  function token(
    role: 'student' | 'faculty' | 'admin' = 'student',
    sub = USER_ID,
  ): string {
    return app.jwt.sign({ sub, role });
  }

  async function request(
    method: 'GET' | 'POST' | 'PUT',
    url: string,
    options: {
      role?: 'student' | 'faculty' | 'admin';
      sub?: string;
      authenticated?: boolean;
      payload?: unknown;
    } = {},
  ) {
    const headers: Record<string, string> = {};

    if (options.authenticated !== false) {
      headers.authorization = `Bearer ${token(
        options.role ?? 'student',
        options.sub ?? USER_ID,
      )}`;
    }

    return app.inject({
      method,
      url,
      headers,
      payload: options.payload as object | undefined,
    });
  }

  it('rejects requests without a token', async () => {
    const response = await request('POST', `/quizzes/${QUIZ_ID}/attempts`, {
      authenticated: false,
    });

    expect(response.statusCode).toBe(401);
    expect(service.start).not.toHaveBeenCalled();
  });

  it.each(['faculty', 'admin'] as const)(
    'rejects the %s role from student attempt routes',
    async (role) => {
      const response = await request('POST', `/quizzes/${QUIZ_ID}/attempts`, {
        role,
      });

      expect(response.statusCode).toBe(403);
      expect(service.start).not.toHaveBeenCalled();
    },
  );

  it('rejects an invalid quiz ID', async () => {
    const response = await request('POST', '/quizzes/not-a-uuid/attempts');

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('INVALID_ID');
    expect(service.start).not.toHaveBeenCalled();
  });

  it('maps the authenticated user ID to the student record ID', async () => {
    service.start.mockResolvedValue(makeAttempt());

    const response = await request('POST', `/quizzes/${QUIZ_ID}/attempts`);

    expect(response.statusCode).toBe(201);
    expect(studentRepository.findByUserId).toHaveBeenCalledWith(USER_ID);
    expect(service.start).toHaveBeenCalledWith(QUIZ_ID, STUDENT_ID);
  });

  it('rejects a student account that is not linked to a student record', async () => {
    studentRepository.findByUserId.mockResolvedValue(undefined);

    const response = await request('POST', `/quizzes/${QUIZ_ID}/attempts`);

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('STUDENT_NOT_LINKED');
    expect(service.start).not.toHaveBeenCalled();
  });

  it('returns questions without correct answers', async () => {
    service.getQuestions.mockResolvedValue([
      {
        id: QUESTION_ID,
        quizId: QUIZ_ID,
        questionText: 'What is 2 + 2?',
        optionA: '3',
        optionB: '4',
        optionC: '5',
        optionD: '6',
        marks: 2,
      },
    ]);

    const response = await request('GET', `/attempts/${ATTEMPT_ID}/questions`);

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.data[0]).not.toHaveProperty('correctOption');
    expect(service.getQuestions).toHaveBeenCalledWith(ATTEMPT_ID, STUDENT_ID);
  });

  it('rejects an invalid attempt ID when fetching questions', async () => {
    const response = await request('GET', '/attempts/not-a-uuid/questions');

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('INVALID_ID');
    expect(service.getQuestions).not.toHaveBeenCalled();
  });

  it('rejects invalid answer options', async () => {
    const response = await request(
      'PUT',
      `/attempts/${ATTEMPT_ID}/answers/${QUESTION_ID}`,
      { payload: { selectedOption: 'E' } },
    );

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect(service.saveAnswer).not.toHaveBeenCalled();
  });

  it('rejects unexpected fields in the answer body', async () => {
    const response = await request(
      'PUT',
      `/attempts/${ATTEMPT_ID}/answers/${QUESTION_ID}`,
      { payload: { selectedOption: 'A', correctOption: 'A' } },
    );

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect(service.saveAnswer).not.toHaveBeenCalled();
  });

  it('rejects an invalid question ID when saving an answer', async () => {
    const response = await request(
      'PUT',
      `/attempts/${ATTEMPT_ID}/answers/not-a-uuid`,
      { payload: { selectedOption: 'A' } },
    );

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('INVALID_ID');
    expect(service.saveAnswer).not.toHaveBeenCalled();
  });

  it('saves a valid answer using the student record ID', async () => {
    service.saveAnswer.mockResolvedValue(undefined);

    const response = await request(
      'PUT',
      `/attempts/${ATTEMPT_ID}/answers/${QUESTION_ID}`,
      { payload: { selectedOption: 'B' } },
    );

    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);
    expect(service.saveAnswer).toHaveBeenCalledWith(
      {
        attemptId: ATTEMPT_ID,
        questionId: QUESTION_ID,
        selectedOption: 'B',
      },
      STUDENT_ID,
    );
  });

  it('rejects an invalid attempt ID when submitting', async () => {
    const response = await request('POST', '/attempts/not-a-uuid/submit');

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('INVALID_ID');
    expect(service.submit).not.toHaveBeenCalled();
  });

  it('submits an attempt and returns its result', async () => {
    service.submit.mockResolvedValue(
      makeAttempt({
        status: 'submitted',
        submittedAt: new Date(),
        score: 8,
      }),
    );

    const response = await request('POST', `/attempts/${ATTEMPT_ID}/submit`);

    expect(response.statusCode).toBe(200);
    expect(response.json().data.status).toBe('submitted');
    expect(response.json().data.score).toBe(8);
    expect(service.submit).toHaveBeenCalledWith(ATTEMPT_ID, STUDENT_ID);
  });

  it('maps an attempt ownership error to 403', async () => {
    service.getQuestions.mockRejectedValue(new Error('FORBIDDEN'));

    const response = await request('GET', `/attempts/${ATTEMPT_ID}/questions`);

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
  });

  it('rejects access when the authenticated student does not own the attempt', async () => {
    studentRepository.findByUserId.mockResolvedValue({
      id: OTHER_STUDENT_ID,
    });
    service.getQuestions.mockRejectedValue(new Error('FORBIDDEN'));

    const response = await request('GET', `/attempts/${ATTEMPT_ID}/questions`, {
      sub: OTHER_USER_ID,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
    expect(studentRepository.findByUserId).toHaveBeenCalledWith(OTHER_USER_ID);
    expect(service.getQuestions).toHaveBeenCalledWith(
      ATTEMPT_ID,
      OTHER_STUDENT_ID,
    );
  });

  it('rejects saving an answer when the attempt belongs to another student', async () => {
    studentRepository.findByUserId.mockResolvedValue({
      id: OTHER_STUDENT_ID,
    });
    service.saveAnswer.mockRejectedValue(new Error('FORBIDDEN'));

    const response = await request(
      'PUT',
      `/attempts/${ATTEMPT_ID}/answers/${QUESTION_ID}`,
      {
        sub: OTHER_USER_ID,
        payload: { selectedOption: 'A' },
      },
    );

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
    expect(service.saveAnswer).toHaveBeenCalledWith(
      {
        attemptId: ATTEMPT_ID,
        questionId: QUESTION_ID,
        selectedOption: 'A',
      },
      OTHER_STUDENT_ID,
    );
  });

  it('returns a submitted attempt result', async () => {
    service.getResult.mockResolvedValue(
      makeAttempt({
        status: 'submitted',
        submittedAt: new Date(),
        score: null,
      }),
    );

    const response = await request('GET', `/attempts/${ATTEMPT_ID}/result`);

    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);
    expect(response.json().data.status).toBe('submitted');
    expect(service.getResult).toHaveBeenCalledWith(ATTEMPT_ID, STUDENT_ID);
  });

  it('rejects an invalid attempt ID when retrieving a result', async () => {
    const response = await request('GET', '/attempts/not-a-uuid/result');

    expect(response.statusCode).toBe(400);
    expect(service.getResult).not.toHaveBeenCalled();
  });

  it('returns 409 when the attempt has not been submitted', async () => {
    service.getResult.mockRejectedValue(new Error('ATTEMPT_NOT_SUBMITTED'));

    const response = await request('GET', `/attempts/${ATTEMPT_ID}/result`);

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('ATTEMPT_NOT_SUBMITTED');
  });
  it('rejects submitting an attempt when it belongs to another student', async () => {
    studentRepository.findByUserId.mockResolvedValue({
      id: OTHER_STUDENT_ID,
    });
    service.submit.mockRejectedValue(new Error('FORBIDDEN'));

    const response = await request('POST', `/attempts/${ATTEMPT_ID}/submit`, {
      sub: OTHER_USER_ID,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
    expect(service.submit).toHaveBeenCalledWith(ATTEMPT_ID, OTHER_STUDENT_ID);
  });

  it('does not expose internal error details', async () => {
    service.submit.mockRejectedValue(new Error('DATABASE_CONNECTION_SECRET'));

    const response = await request('POST', `/attempts/${ATTEMPT_ID}/submit`);

    expect(response.statusCode).toBe(500);
    expect(response.json().error.code).toBe('INTERNAL_ERROR');
    expect(response.body).not.toContain('DATABASE_CONNECTION_SECRET');
  });

  it('rejects an invalid attempt ID for proctoring events', async () => {
    const response = await request(
      'POST',
      '/attempts/not-a-uuid/proctoring-events',
      { payload: { type: 'tab_switch' } },
    );

    expect(response.statusCode).toBe(400);
    expect(service.recordProctoringEvent).not.toHaveBeenCalled();
  });

  it('rejects an invalid proctoring event type', async () => {
    const response = await request(
      'POST',
      `/attempts/${ATTEMPT_ID}/proctoring-events`,
      { payload: { type: 'unknown_event' } },
    );

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect(service.recordProctoringEvent).not.toHaveBeenCalled();
  });

  it('records a valid proctoring event', async () => {
    const attempt = makeAttempt({
      tabSwitchCount: 1,
      suspiciousActivity: true,
    });
    service.recordProctoringEvent.mockResolvedValue(attempt);

    const response = await request(
      'POST',
      `/attempts/${ATTEMPT_ID}/proctoring-events`,
      {
        payload: {
          type: 'tab_switch',
          metadata: 'Browser tab changed',
        },
      },
    );

    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);
    expect(service.recordProctoringEvent).toHaveBeenCalledWith(
      {
        attemptId: ATTEMPT_ID,
        type: 'tab_switch',
        metadata: 'Browser tab changed',
      },
      STUDENT_ID,
    );
  });

  it('rejects unauthenticated proctoring requests', async () => {
    const response = await request(
      'POST',
      `/attempts/${ATTEMPT_ID}/proctoring-events`,
      {
        authenticated: false,
        payload: { type: 'tab_switch' },
      },
    );

    expect(response.statusCode).toBe(401);
    expect(service.recordProctoringEvent).not.toHaveBeenCalled();
  });
});
