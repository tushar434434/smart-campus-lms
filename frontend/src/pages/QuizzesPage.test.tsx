// @vitest-environment jsdom
import {
  cleanup,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QuizzesPage } from './QuizzesPage';

const mocks = vi.hoisted(() => ({
  listAllCourses: vi.fn(),
  listEnrolledCourses: vi.fn(),
  listTeachingCourses: vi.fn(),
  listByCourse: vi.fn(),
  listMine: vi.fn(),
  questions: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock('../api/courses.api', () => ({
  listAllCourses: mocks.listAllCourses,
  listEnrolledCourses: mocks.listEnrolledCourses,
  listTeachingCourses: mocks.listTeachingCourses,
}));
vi.mock('../api/quizzes.api', () => ({
  quizzesApi: {
    listByCourse: mocks.listByCourse,
    listMine: mocks.listMine,
    questions: mocks.questions,
  },
}));
vi.mock('../api/reports.api', () => ({
  reportsApi: { quiz: vi.fn() },
  savePdf: vi.fn(),
}));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mocks.useAuth(),
}));

const enrolledCourse = {
  id: 'course-enrolled',
  title: 'Enrolled Course',
  code: 'CS101',
  credits: 3,
  ownerFacultyId: 'faculty-1',
  approvalStatus: 'approved',
  rejectionReason: null,
  reviewedAt: null,
  reviewedById: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};
const catalogCourse = {
  ...enrolledCourse,
  id: 'course-catalog',
  title: 'Other Catalog Course',
  code: 'CS999',
};
const publishedQuiz = {
  id: 'quiz-published',
  courseId: enrolledCourse.id,
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

describe('student quiz visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAuth.mockReturnValue({
      token: 'student-token',
      user: { id: 'user-1', role: 'student' },
    });
    mocks.listEnrolledCourses.mockResolvedValue([enrolledCourse]);
    mocks.listAllCourses.mockResolvedValue([catalogCourse, enrolledCourse]);
    mocks.listByCourse.mockResolvedValue([publishedQuiz]);
    mocks.listMine.mockResolvedValue([publishedQuiz]);
    mocks.questions.mockResolvedValue([]);
  });

  it('loads enrolled courses and shows published quizzes to students', async () => {
    render(
      <MemoryRouter>
        <QuizzesPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Midterm quiz')).toBeTruthy();
    await waitFor(() => {
      expect(mocks.listEnrolledCourses).toHaveBeenCalledWith('student-token');
      expect(mocks.listAllCourses).not.toHaveBeenCalled();
      expect(mocks.listMine).toHaveBeenCalledWith('student-token');
      expect(mocks.listByCourse).not.toHaveBeenCalled();
    });
    expect(screen.queryByText('Other Catalog Course')).toBeNull();
  });

  it('opens a requested published quiz from the dashboard deep link', async () => {
    mocks.questions.mockResolvedValue([]);
    render(
      <MemoryRouter initialEntries={['/quizzes?quizId=quiz-published']}>
        <QuizzesPage />
      </MemoryRouter>,
    );

    expect((await screen.findAllByText('Midterm quiz')).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(mocks.questions).toHaveBeenCalledWith('quiz-published', 'student-token');
    });
    expect(screen.getByText('QUIZ DETAILS')).toBeTruthy();
  });
});
