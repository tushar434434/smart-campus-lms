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
import { authApi } from '../api/auth.api';
import { ForgotPasswordPage } from './ForgotPasswordPage';

const mocks = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  verifyResetOtp: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock('../api/auth.api', () => ({ authApi: mocks }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authApi.requestPasswordReset).mockResolvedValue(undefined);
  vi.mocked(authApi.verifyResetOtp).mockResolvedValue({
    resetToken: 'transient-reset-token',
  });
  vi.mocked(authApi.resetPassword).mockResolvedValue(undefined);
});

afterEach(() => cleanup());

function renderRecovery() {
  return render(
    <MemoryRouter initialEntries={['/forgot-password']}>
      <Routes>
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('password recovery UI', () => {
  it('walks through email, OTP, and password reset without persisting the token', async () => {
    renderRecovery();
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'learner@example.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset code' }));
    expect(
      await screen.findByRole('heading', { name: 'Check your email' }),
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Six-digit code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));
    expect(
      await screen.findByRole('heading', { name: 'Choose a new password' }),
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'new-secure-password' },
    });
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'new-secure-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(
      await screen.findByRole('heading', { name: 'Password updated' }),
    ).toBeTruthy();

    await waitFor(() => {
      expect(authApi.requestPasswordReset).toHaveBeenCalledWith(
        'learner@example.test',
      );
      expect(authApi.verifyResetOtp).toHaveBeenCalledWith(
        'learner@example.test',
        '123456',
      );
      expect(authApi.resetPassword).toHaveBeenCalledWith(
        'transient-reset-token',
        'new-secure-password',
      );
    });
    expect(window.localStorage.length).toBe(0);
  });
});
