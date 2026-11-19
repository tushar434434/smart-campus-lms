import bcrypt from 'bcrypt';

import { AppError } from '../../errors/app-error.js';
import type { AuthRepository } from './auth.repository.interface.js';
import type {
  ChangePasswordInput,
  RegisterInput,
  UpdateProfileInput,
  User,
} from './auth.schema.js';

export function createAuthService(
  repository: AuthRepository,
  options?: { linkRegisteredStudent?: (userId: string) => Promise<unknown> },
) {
  return {
    async register(input: RegisterInput): Promise<Omit<User, 'passwordHash'>> {
      const email = input.email.toLowerCase();

      const existingUser = await repository.findByEmail(email);

      if (existingUser) {
        throw new AppError(
          'Email is already registered',
          409,
          'EMAIL_ALREADY_EXISTS',
        );
      }

      const passwordHash = await bcrypt.hash(input.password, 12);

      const user = await repository.create({
        name: input.name,
        email,
        passwordHash,
        role: 'student',
      });

      if (options?.linkRegisteredStudent) {
        try {
          await options.linkRegisteredStudent(user.id);
        } catch {
          // Registration still succeeds if a matching profile cannot be linked.
        }
      }

      const { passwordHash: _passwordHash, ...safeUser } = user;
      void _passwordHash;

      return safeUser;
    },

    async login(email: string, password: string) {
      const user = await repository.findByEmail(email.toLowerCase());

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

      if (user.suspendedAt) {
        throw new AppError(
          'This account has been suspended',
          403,
          'ACCOUNT_SUSPENDED',
        );
      }

      const { passwordHash: _passwordHash, ...safeUser } = user;
      void _passwordHash;

      return safeUser;
    },

    async getUserById(id: string) {
      const user = await repository.findById(id);

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const { passwordHash: _passwordHash, ...safeUser } = user;
      void _passwordHash;

      return safeUser;
    },

    async updateProfile(id: string, input: UpdateProfileInput) {
      const updated = await repository.updateName(id, input.name);
      if (!updated) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }
      const { passwordHash: _passwordHash, ...safeUser } = updated;
      void _passwordHash;
      return safeUser;
    },

    async changePassword(id: string, input: ChangePasswordInput) {
      const user = await repository.findById(id);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }
      const matches = await bcrypt.compare(
        input.currentPassword,
        user.passwordHash,
      );
      if (!matches) {
        throw new AppError(
          'Current password is incorrect',
          400,
          'INVALID_CURRENT_PASSWORD',
        );
      }
      const passwordHash = await bcrypt.hash(input.newPassword, 12);
      const updated = await repository.updatePasswordHash(id, passwordHash);
      if (!updated) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }
    },
  };
}
