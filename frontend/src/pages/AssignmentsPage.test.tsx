// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssignmentsPage } from './AssignmentsPage';

const mocks = vi.hoisted(() => ({
  listAllCourses: vi.fn(),
  listTeachingCourses: vi.fn(),
  listByCourse: vi.fn(),
  listRosterByAssignment: vi.fn(),
}));

vi.mock('../api/courses.api', () => ({
  listAllCourses: mocks.listAllCourses,
  listTeachingCourses: mocks.listTeachingCourses,
}));
vi.mock('../api/assignments.api', () => ({
  assignmentsApi: { listByCourse: mocks.listByCourse },
}));
vi.mock('../api/submissions.api', () => ({
  submissionsApi: { listRosterByAssignment: mocks.listRosterByAssignment },
}));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'faculty-token',
    user: { id: 'faculty-1', role: 'faculty' },
  }),
}));

const course = {
  id: 'course-1',
  title: 'Data Science',
  code: 'DS101',
  credits: 3,
  ownerFacultyId: 'faculty-1',
  createdAt: '2026-01-01T00:00:00.000Z',
};
const assignment = {
  id: 'assignment-1',
  courseId: course.id,
  title: 'Assignment One',
  description: 'Complete the practical exercise.',
  dueAt: '2027-01-01T00:00:00.000Z',
  maxMarks: 20,
  createdAt: '2026-01-01T00:00:00.000Z',
};
const roster = [
  {
    student: {
      id: 'student-1',
      name: 'Avery Student',
      email: 'avery@campus.test',
      enrollmentNumber: 'SC2026-000001',
    },
    submission: {
      id: 'submission-1',
      studentId: 'student-1',
      assignmentId: assignment.id,
      content: 'A sufficiently long submission.',
      status: 'submitted' as const,
      submittedAt: '2026-10-28T10:00:00.000Z',
      updatedAt: '2026-10-28T10:00:00.000Z',
    },
    status: 'submitted' as const,
  },
  {
    student: {
      id: 'student-2',
      name: 'Blair Student',
      email: 'blair@campus.test',
      enrollmentNumber: 'SC2026-000002',
    },
    submission: {
      id: 'submission-2',
      studentId: 'student-2',
      assignmentId: assignment.id,
      content: 'Another sufficiently long submission.',
      status: 'graded' as const,
      marks: 18,
      submittedAt: '2026-10-28T11:00:00.000Z',
      updatedAt: '2026-10-28T12:00:00.000Z',
    },
    status: 'graded' as const,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listTeachingCourses.mockResolvedValue([course]);
  mocks.listByCourse.mockResolvedValue([assignment]);
  mocks.listRosterByAssignment.mockResolvedValue(roster);
});

afterEach(cleanup);

describe('assignment roster filters', () => {
  it('searches student details and filters by submission status', async () => {
    render(
      <MemoryRouter>
        <AssignmentsPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Review/ }));
    await waitFor(() => {
      expect(mocks.listRosterByAssignment).toHaveBeenCalledWith(
        assignment.id,
        'faculty-token',
      );
    });
    expect(await screen.findByText('Avery Student')).toBeTruthy();
    expect(screen.getByText('Blair Student')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Search students'), {
      target: { value: 'blair@campus.test' },
    });
    expect(screen.getByText('Blair Student')).toBeTruthy();
    expect(screen.queryByText('Avery Student')).toBeNull();

    fireEvent.change(screen.getByLabelText('Search students'), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText('Filter by submission status'), {
      target: { value: 'graded' },
    });
    expect(screen.getByText('Blair Student')).toBeTruthy();
    expect(screen.queryByText('Avery Student')).toBeNull();
  });
});
