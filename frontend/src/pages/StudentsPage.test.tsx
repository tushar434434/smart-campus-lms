// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { studentsApi } from '../api/students.api';
import { listAllCourses } from '../api/courses.api';
import { StudentDetailPage } from './StudentsPage';

const mocks = vi.hoisted(() => ({
  studentsApi: {
    get: vi.fn(),
    enrollments: vi.fn(),
    linkableUsers: vi.fn(),
    linkUser: vi.fn(),
    update: vi.fn(),
    enroll: vi.fn(),
    removeEnrollment: vi.fn(),
  },
  listAllCourses: vi.fn(),
}));

vi.mock('../api/students.api', () => ({ studentsApi: mocks.studentsApi }));
vi.mock('../api/courses.api', () => ({ listAllCourses: mocks.listAllCourses }));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ token: 'faculty-token' }),
}));

const student = {
  id: 'student-profile-id',
  userId: null,
  name: 'Sam Student',
  email: 'sam.profile@example.com',
  enrollmentNumber: 'ENR2026001',
  department: 'Computer Science',
  semester: 4,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const account = {
  id: 'registered-account-uuid',
  name: 'Sam Registered',
  email: 'sam.registered@example.com',
};

function accountPage(accounts = [account]) {
  return {
    accounts,
    pagination: {
      page: 1,
      limit: 10,
      total: accounts.length,
      totalPages: accounts.length ? 1 : 0,
    },
  };
}

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={['/students/student-profile-id']}>
      <Routes>
        <Route path="/students/:studentId" element={<StudentDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(studentsApi.get).mockResolvedValue(student);
  vi.mocked(studentsApi.enrollments).mockResolvedValue([]);
  vi.mocked(studentsApi.linkableUsers).mockResolvedValue(accountPage());
  vi.mocked(studentsApi.linkUser).mockResolvedValue({
    ...student,
    userId: account.id,
  });
  vi.mocked(listAllCourses).mockResolvedValue([]);
});

afterEach(() => cleanup());

describe('Student account linking', () => {
  it('shows loading while eligible accounts are being fetched', async () => {
    let resolveAccounts!: (result: ReturnType<typeof accountPage>) => void;
    vi.mocked(studentsApi.linkableUsers).mockReturnValue(
      new Promise((resolve) => {
        resolveAccounts = resolve;
      }),
    );

    renderProfile();

    expect(await screen.findByText('Loading student accounts…')).toBeTruthy();
    resolveAccounts(accountPage());
    expect(
      await screen.findByRole('option', { name: /Sam Registered/ }),
    ).toBeTruthy();
  });

  it('shows an empty state when no eligible accounts are returned', async () => {
    vi.mocked(studentsApi.linkableUsers).mockResolvedValue(accountPage([]));

    renderProfile();

    expect(
      await screen.findByText('No eligible student accounts found.'),
    ).toBeTruthy();
  });

  it('shows a safe error and retries loading accounts', async () => {
    vi.mocked(studentsApi.linkableUsers)
      .mockRejectedValueOnce(
        new ApiError('private server detail', 500, 'INTERNAL_SERVER_ERROR'),
      )
      .mockResolvedValueOnce(accountPage());

    renderProfile();

    expect(
      await screen.findByText('Unable to load eligible student accounts.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(
      await screen.findByRole('option', { name: /Sam Registered/ }),
    ).toBeTruthy();
    expect(screen.queryByText('private server detail')).toBeNull();
  });

  it('searches, selects with the keyboard, and links the selected UUID', async () => {
    renderProfile();

    const search = await screen.findByLabelText('Registered student account');
    expect(search.getAttribute('role')).toBe('combobox');
    await waitFor(() => {
      expect(studentsApi.linkableUsers).toHaveBeenCalledWith(
        student.id,
        1,
        '',
        'faculty-token',
      );
    });
    fireEvent.change(search, { target: { value: 'Sam Registered' } });
    await waitFor(() => {
      expect(studentsApi.linkableUsers).toHaveBeenCalledWith(
        student.id,
        1,
        'Sam Registered',
        'faculty-token',
      );
    });

    fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(document.querySelector('.selected-account')?.textContent).toContain(
      'Sam Registered',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Link account' }));
    await waitFor(() => {
      expect(studentsApi.linkUser).toHaveBeenCalledWith(
        student.id,
        account.id,
        'faculty-token',
      );
    });
    expect(await screen.findByText(/Linked Sam Registered/)).toBeTruthy();
  });

  it('shows a conflict message when the account was linked concurrently', async () => {
    vi.mocked(studentsApi.linkUser).mockRejectedValue(
      new ApiError('database constraint details', 409, 'USER_ALREADY_LINKED'),
    );

    renderProfile();
    const search = await screen.findByLabelText('Registered student account');
    fireEvent.click(
      await screen.findByRole('option', { name: /Sam Registered/ }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Link account' }));

    expect(await screen.findByText(/linked in another request/)).toBeTruthy();
    expect(screen.queryByText('database constraint details')).toBeNull();
    expect(search).toBeTruthy();
  });
});
