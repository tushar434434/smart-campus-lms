// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { DashboardPage } from './DashboardPage';

const mocks = vi.hoisted(() => ({
  listCourses: vi.fn(),
  listStudents: vi.fn(),
  myActivity: vi.fn(),
  studentActivity: vi.fn(),
  listMine: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock('../api/courses.api', () => ({
  coursesApi: { list: mocks.listCourses },
}));
vi.mock('../api/students.api', () => ({
  studentsApi: { list: mocks.listStudents },
}));
vi.mock('../api/submissions.api', () => ({
  submissionsApi: { myActivity: mocks.myActivity },
}));
vi.mock('../api/quizzes.api', () => ({
  quizzesApi: {
    studentActivity: mocks.studentActivity,
    listMine: mocks.listMine,
  },
}));
vi.mock('../api/enrollments.api', () => ({
  enrollmentsApi: { requests: vi.fn().mockResolvedValue([]) },
}));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mocks.useAuth(),
}));

const publishedQuiz = {
  id: 'quiz-published',
  courseId: 'course-enrolled',
  title: 'Midterm quiz',
  description: 'Published assessment',
  durationMinutes: 30,
  maxMarks: 20,
  maxAttempts: 1,
  status: 'published' as const,
  startsAt: null,
  endsAt: null,
  resultsReleasedAt: null,
  showMarks: false,
  showCorrectAnswers: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

afterEach(() => cleanup());

describe('student dashboard quiz visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAuth.mockReturnValue({
      token: 'student-token',
      user: { id: 'user-1', name: 'Ada Student', role: 'student' },
    });
    mocks.listCourses.mockResolvedValue({
      courses: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
    mocks.myActivity.mockResolvedValue([]);
    mocks.studentActivity.mockResolvedValue([]);
    mocks.listMine.mockResolvedValue([publishedQuiz]);
  });

  it('shows newly published quizzes without requiring a prior attempt', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Midterm quiz')).toBeTruthy();
    expect(screen.getByText('Published for you')).toBeTruthy();
    expect(screen.queryByText('No published quizzes in your enrolled courses yet.')).toBeNull();
    await waitFor(() => {
      expect(mocks.listMine).toHaveBeenCalledWith('student-token');
      expect(mocks.studentActivity).toHaveBeenCalledWith('student-token');
    });
  });

  it('does not show published quizzes when the student list is empty', async () => {
    mocks.listMine.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText('No published quizzes in your enrolled courses yet.'),
    ).toBeTruthy();
    expect(screen.queryByText('Midterm quiz')).toBeNull();
  });

  it('does not load student quiz lists for faculty', async () => {
    mocks.useAuth.mockReturnValue({
      token: 'faculty-token',
      user: { id: 'user-faculty', name: 'Fac Member', role: 'faculty' },
    });
    mocks.listStudents.mockResolvedValue({
      students: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Recently added courses')).toBeTruthy();
    expect(mocks.listMine).not.toHaveBeenCalled();
    expect(mocks.studentActivity).not.toHaveBeenCalled();
    expect(screen.queryByText('Published for you')).toBeNull();
  });

  it('renders published quizzes, submissions, and quiz attempts when all three API requests succeed', async () => {
    mocks.myActivity.mockResolvedValue([
      {
        id: 'sub-1',
        assignmentId: 'assign-1',
        assignmentTitle: 'Algorithms Homework 1',
        courseId: 'course-1',
        courseTitle: 'Data Structures',
        status: 'submitted',
        submittedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    mocks.studentActivity.mockResolvedValue([
      {
        id: 'attempt-1',
        quizId: 'quiz-diagnostic',
        quizTitle: 'Diagnostic quiz',
        courseTitle: 'Data Structures',
        attemptNumber: 1,
        status: 'submitted',
        score: 18,
        startedAt: '2026-01-01T00:00:00.000Z',
        completedAt: '2026-01-01T00:30:00.000Z',
      },
    ]);
    mocks.listMine.mockResolvedValue([publishedQuiz]);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Midterm quiz')).toBeTruthy();
    expect(screen.getByText('Diagnostic quiz')).toBeTruthy();
    expect(screen.getByText('Algorithms Homework 1')).toBeTruthy();
    expect(screen.getByText(/Attempt 1/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('displays published quizzes when assignment activity fails', async () => {
    mocks.myActivity.mockRejectedValue(
      new ApiError('Failed to fetch assignments', 500, 'INTERNAL_ERROR'),
    );
    mocks.studentActivity.mockResolvedValue([]);
    mocks.listMine.mockResolvedValue([publishedQuiz]);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Midterm quiz')).toBeTruthy();
    expect(screen.getByText('Published for you')).toBeTruthy();
    expect(screen.getByText('Failed to fetch assignments')).toBeTruthy();
    expect(
      screen.queryByText('Your account is not linked to a student profile yet. Ask faculty or an administrator to create and link your student record.'),
    ).toBeNull();
  });

  it('displays published quizzes when quiz-attempt activity fails', async () => {
    mocks.myActivity.mockResolvedValue([]);
    mocks.studentActivity.mockRejectedValue(
      new ApiError('Failed to fetch quiz attempts', 500, 'INTERNAL_ERROR'),
    );
    mocks.listMine.mockResolvedValue([publishedQuiz]);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Midterm quiz')).toBeTruthy();
    expect(screen.getByText('Published for you')).toBeTruthy();
    expect(screen.getByText('Failed to fetch quiz attempts')).toBeTruthy();
    expect(
      screen.queryByText('Your account is not linked to a student profile yet. Ask faculty or an administrator to create and link your student record.'),
    ).toBeNull();
  });

  it('displays an appropriate error when the quiz-list API fails while keeping other activity', async () => {
    mocks.myActivity.mockResolvedValue([
      {
        id: 'sub-1',
        assignmentId: 'assign-1',
        assignmentTitle: 'Algorithms Homework 1',
        courseId: 'course-1',
        courseTitle: 'Data Structures',
        status: 'submitted',
        submittedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    mocks.studentActivity.mockResolvedValue([]);
    mocks.listMine.mockRejectedValue(
      new ApiError('Unable to load quizzes at this time.', 500, 'QUIZ_FETCH_FAILED'),
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Unable to load quizzes at this time.')).toBeTruthy();
    expect(screen.getByText('Algorithms Homework 1')).toBeTruthy();
    expect(screen.queryByText('Midterm quiz')).toBeNull();
    expect(
      screen.queryByText('Your account is not linked to a student profile yet. Ask faculty or an administrator to create and link your student record.'),
    ).toBeNull();
  });

  it('shows missing student profile notice when student profile is genuinely not linked', async () => {
    mocks.listMine.mockRejectedValue(
      new ApiError('Student account is not linked', 403, 'STUDENT_NOT_LINKED'),
    );
    mocks.myActivity.mockRejectedValue(
      new ApiError('Student account is not linked to a student record', 403, 'FORBIDDEN'),
    );
    mocks.studentActivity.mockRejectedValue(
      new ApiError('Student account is not linked to a student record', 403, 'STUDENT_NOT_LINKED'),
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(
        'Your account is not linked to a student profile yet. Ask faculty or an administrator to create and link your student record.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Published for you')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not mark student profile as missing when an activity endpoint returns an unrelated 403', async () => {
    mocks.myActivity.mockRejectedValue(
      new ApiError('You do not have permission to view submissions', 403, 'FORBIDDEN'),
    );
    mocks.studentActivity.mockResolvedValue([]);
    mocks.listMine.mockResolvedValue([publishedQuiz]);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Midterm quiz')).toBeTruthy();
    expect(screen.getByText('Published for you')).toBeTruthy();
    expect(
      screen.queryByText('Your account is not linked to a student profile yet. Ask faculty or an administrator to create and link your student record.'),
    ).toBeNull();
    expect(screen.getByText('You do not have permission to view submissions')).toBeTruthy();
  });

  it('displays published quizzes when the course catalog request fails', async () => {
    mocks.listCourses.mockRejectedValue(
      new ApiError('Unable to load courses', 500, 'INTERNAL_ERROR'),
    );
    mocks.listMine.mockResolvedValue([publishedQuiz]);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Midterm quiz')).toBeTruthy();
    expect(screen.getByText('Published for you')).toBeTruthy();
    expect(screen.getByText('Unable to load courses')).toBeTruthy();
  });

  it('does not load student quiz lists for administrators', async () => {
    mocks.useAuth.mockReturnValue({
      token: 'admin-token',
      user: { id: 'user-admin', name: 'Admin User', role: 'admin' },
    });
    mocks.listStudents.mockResolvedValue({
      students: [],
      pagination: { page: 1, limit: 10, total: 4, totalPages: 1 },
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Recently added courses')).toBeTruthy();
    expect(await screen.findByText('Student records')).toBeTruthy();
    expect(mocks.listMine).not.toHaveBeenCalled();
    expect(mocks.studentActivity).not.toHaveBeenCalled();
    expect(screen.queryByText('Published for you')).toBeNull();
  });

  it('allows the student to open an eligible quiz from the dashboard', async () => {
    mocks.listMine.mockResolvedValue([publishedQuiz]);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Midterm quiz')).toBeTruthy();
    const takeQuizLink = screen.getByRole('link', { name: 'Take quiz' });
    expect(takeQuizLink.getAttribute('href')).toBe('/quizzes?quizId=quiz-published');
    const openQuizzesLink = screen.getByRole('link', { name: /Open quizzes/i });
    expect(openQuizzesLink.getAttribute('href')).toBe('/quizzes');
  });
});
