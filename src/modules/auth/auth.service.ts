import bcrypt from 'bcrypt';

import { AppError } from '../../errors/app-error.js';

import type { AuthRepository } from './auth.repository.interface.js';
import type { RegisterInput, User } from './auth.schema.js';

export function createAuthService(repository: AuthRepository) {
  return {
    async register(input: RegisterInput): Promise<Omit<User, 'passwordHash'>> {
      const email = input.email.toLowerCase();

      const existingUser = repository.findByEmail(email);

      if (existingUser) {
        throw new AppError(
          'Email is already registered',
          409,
          'EMAIL_ALREADY_EXISTS',
        );
      }

      const passwordHash = await bcrypt.hash(input.password, 12);

      const user = repository.create({
        name: input.name,
        email,
        passwordHash,
        role: input.role,
      });

      const { passwordHash: _, ...safeUser } = user;

      return safeUser;
    },

    async login(email: string, password: string) {
      const user = repository.findByEmail(email.toLowerCase());

      if (!user) {
        throw new AppError(
          'Invalid email or password',
          401,
          'INVALID_CREDENTIALS',
        );
      }

      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

      if (!isPasswordValid) {
        throw new AppError(
          'Invalid email or password',
          401,
          'INVALID_CREDENTIALS',
        );
      }

      const { passwordHash: _, ...safeUser } = user;

      return safeUser;
    },

    getUserById(id: string) {
      const user = repository.findById(id);

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const { passwordHash: _, ...safeUser } = user;

      return safeUser;
    },
  };
}
