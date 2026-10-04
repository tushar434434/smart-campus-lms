import type { User, UserRole } from './auth.schema.js';

export type CreateUserInput = {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
};

export interface AuthRepository {
  create(input: CreateUserInput): User;

  findByEmail(email: string): User | undefined;

  findById(id: string): User | undefined;

  findAll(): User[];
}
