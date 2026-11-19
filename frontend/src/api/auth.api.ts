import { apiRequest } from './client';
import type { User } from '../types/api';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  name: string;
}

export interface ResetPasswordResult {
  resetToken: string;
}

export interface LoginResult {
  user: User;
  token: string;
}

export const authApi = {
  login: (input: LoginInput) =>
    apiRequest<LoginResult>('/auth/login', { method: 'POST', body: input }),
  register: (input: RegisterInput) =>
    apiRequest<User>('/auth/register', { method: 'POST', body: input }),
  me: (token: string) => apiRequest<User>('/auth/me', { token }),
  updateProfile: (token: string, name: string) =>
    apiRequest<User>('/auth/me', {
      method: 'PATCH',
      token,
      body: { name },
    }),
  changePassword: (
    token: string,
    currentPassword: string,
    newPassword: string,
  ) =>
    apiRequest<void>('/auth/change-password', {
      method: 'POST',
      token,
      body: { currentPassword, newPassword },
    }),
  requestPasswordReset: (email: string) =>
    apiRequest<void>('/auth/forgot-password', {
      method: 'POST',
      body: { email },
    }),
  verifyResetOtp: (email: string, otp: string) =>
    apiRequest<ResetPasswordResult>('/auth/verify-reset-otp', {
      method: 'POST',
      body: { email, otp },
    }),
  resetPassword: (resetToken: string, newPassword: string) =>
    apiRequest<void>('/auth/reset-password', {
      method: 'POST',
      body: { resetToken, newPassword },
    }),
};
