import type { User, UserRole } from './auth.schema.js';

export type CreateUserInput = {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
};

export interface StudentAccount {
  id: string;
  name: string;
  email: string;
}

export interface AuthRepository {
  create(input: CreateUserInput): Promise<User>;

  findByEmail(email: string): Promise<User | undefined>;

  findById(id: string): Promise<User | undefined>;

  findAll(): Promise<User[]>;

  updateName(id: string, name: string): Promise<User | undefined>;

  updatePasswordHash(id: string, passwordHash: string): Promise<boolean>;

  setSuspendedAt(
    id: string,
    suspendedAt: string | null,
  ): Promise<User | undefined>;

  findStudentAccounts(input: {
    page: number;
    limit: number;
    search?: string;
    excludedUserIds: string[];
  }): Promise<{ accounts: StudentAccount[]; total: number }>;
}
