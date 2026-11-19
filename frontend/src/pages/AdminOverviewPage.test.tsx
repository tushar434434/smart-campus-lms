// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminApi } from '../api/admin.api';
import { AdminOverviewPage } from './AdminOverviewPage';

const mocks = vi.hoisted(() => ({
  getDashboardStats: vi.fn(),
  listUsers: vi.fn(),
  listAllCourses: vi.fn(),
  assignFaculty: vi.fn(),
}));

vi.mock('../api/admin.api', () => ({ adminApi: mocks }));
vi.mock('../api/courses.api', () => ({
  listAllCourses: mocks.listAllCourses,
  coursesApi: { assignFaculty: mocks.assignFaculty },
}));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ token: 'admin-token' }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(adminApi.getDashboardStats).mockResolvedValue({
    totalUsers: 5,
    students: 3,
    faculty: 1,
    administrators: 1,
    courses: 2,
    assignments: 4,
    quizzes: 1,
    recentUsers: [],
    recentRoleChanges: [],
  });
  vi.mocked(adminApi.listUsers).mockResolvedValue({
    users: [],
    pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
  });
  mocks.listAllCourses.mockResolvedValue([]);
});

afterEach(cleanup);

describe('admin overview', () => {
  it('loads live dashboard totals and empty states', async () => {
    render(
      <MemoryRouter>
        <AdminOverviewPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Campus overview')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('No user registrations yet')).toBeTruthy();
    expect(adminApi.getDashboardStats).toHaveBeenCalledWith('admin-token');
  });

  it('offers retry when the statistics request fails', async () => {
    vi.mocked(adminApi.getDashboardStats).mockRejectedValueOnce(
      new Error('network failure'),
    );
    render(
      <MemoryRouter>
        <AdminOverviewPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Retry')).toBeTruthy();
    vi.mocked(adminApi.getDashboardStats).mockResolvedValueOnce({
      totalUsers: 0,
      students: 0,
      faculty: 0,
      administrators: 0,
      courses: 0,
      assignments: 0,
      quizzes: 0,
      recentUsers: [],
      recentRoleChanges: [],
    });
    screen.getByText('Retry').click();
    await waitFor(() => {
      expect(adminApi.getDashboardStats).toHaveBeenCalledTimes(2);
    });
  });
});
