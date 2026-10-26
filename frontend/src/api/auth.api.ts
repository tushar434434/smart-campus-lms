import { apiRequest } from './client';
import type { User } from '../types/api';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  name: string;
  role: 'student' | 'faculty';
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
};
