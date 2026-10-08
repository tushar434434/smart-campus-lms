import type { User, UserRole } from './auth.schema.js';

export type CreateUserInput = {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
};

export interface AuthRepository {
  create(input: CreateUserInput): Promise<User>;

  findByEmail(email: string): Promise<User | undefined>;

  findById(id: string): Promise<User | undefined>;

  findAll(): Promise<User[]>;
}