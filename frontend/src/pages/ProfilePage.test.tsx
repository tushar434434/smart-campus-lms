// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '../api/auth.api';
import { ProfilePage } from './ProfilePage';

const mocks = vi.hoisted(() => ({
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
  updateSessionUser: vi.fn(),
}));

vi.mock('../api/auth.api', () => ({
  authApi: {
    updateProfile: mocks.updateProfile,
    changePassword: mocks.changePassword,
  },
}));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'user-token',
    user: {
      id: 'user-1',
      name: 'Current User',
      email: 'user@example.test',
      role: 'student',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    updateSessionUser: mocks.updateSessionUser,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateProfile.mockResolvedValue({
    id: 'user-1',
    name: 'Updated User',
    email: 'user@example.test',
    role: 'student',
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  mocks.changePassword.mockResolvedValue(undefined);
});

afterEach(() => cleanup());

describe('profile settings', () => {
  it('saves a new display name', async () => {
    render(<ProfilePage />);
    fireEvent.change(screen.getByLabelText('Display name'), {
      target: { value: 'Updated User' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    await waitFor(() => {
      expect(authApi.updateProfile).toHaveBeenCalledWith(
        'user-token',
        'Updated User',
      );
    });
    expect(screen.getByText('Your display name was updated.')).toBeTruthy();
  });
});
