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
import { adminApi } from '../api/admin.api';
import { AdminUsersPage } from './AdminUsersPage';

const mocks = vi.hoisted(() => ({
  listUsers: vi.fn(),
  getUser: vi.fn(),
  changeRole: vi.fn(),
  listRoleAuditLogs: vi.fn(),
  setSuspension: vi.fn(),
}));

vi.mock('../api/admin.api', () => ({ adminApi: mocks }));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'admin-token',
    user: {
      id: 'admin-1',
      name: 'Current Admin',
      email: 'admin@example.test',
      role: 'admin',
    },
  }),
}));

const pagination = { page: 1, limit: 10, total: 1, totalPages: 1 };
const account = {
  id: 'user-1',
  name: 'Student One',
  email: 'student@example.test',
  role: 'student' as const,
  suspendedAt: null,
  createdAt: '2026-10-27T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(adminApi.listUsers).mockResolvedValue({
    users: [account],
    pagination,
  });
  vi.mocked(adminApi.getUser).mockResolvedValue(account);
  vi.mocked(adminApi.listRoleAuditLogs).mockResolvedValue({
    logs: [],
    pagination: { ...pagination, total: 0, totalPages: 0 },
  });
  vi.mocked(adminApi.changeRole).mockResolvedValue({
    id: 'audit-1',
    actorId: 'admin-1',
    actorName: 'Current Admin',
    actorEmail: 'admin@example.test',
    targetId: account.id,
    targetName: account.name,
    targetEmail: account.email,
    previousRole: 'student',
    newRole: 'faculty',
    createdAt: '2026-10-27T00:00:00.000Z',
  });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('admin user management UI', () => {
  it('lists accounts and confirms role changes', async () => {
    render(
      <MemoryRouter>
        <AdminUsersPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('student@example.test')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Role for Student One'), {
      target: { value: 'faculty' },
    });

    await waitFor(() => {
      expect(adminApi.changeRole).toHaveBeenCalledWith(
        'admin-token',
        'user-1',
        'faculty',
      );
    });
    expect(
      await screen.findByText("Student One's role was updated to faculty."),
    ).toBeTruthy();
  });

  it('loads account details without exposing private fields', async () => {
    render(
      <MemoryRouter>
        <AdminUsersPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /view/i }));
    expect(await screen.findByText('Account details')).toBeTruthy();
    expect(await screen.findByText(account.id)).toBeTruthy();
    expect(adminApi.getUser).toHaveBeenCalledWith('admin-token', account.id);
  });

  it('confirms account suspension', async () => {
    vi.mocked(adminApi.setSuspension).mockResolvedValue({
      ...account,
      suspendedAt: '2026-11-06T00:00:00.000Z',
    });
    render(
      <MemoryRouter>
        <AdminUsersPage />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Suspend' }));
    await waitFor(() => {
      expect(adminApi.setSuspension).toHaveBeenCalledWith(
        'admin-token',
        'user-1',
        true,
      );
    });
  });
});
