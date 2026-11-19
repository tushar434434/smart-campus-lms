import { randomUUID } from 'node:crypto';

import type {
  AuthRepository,
  CreateUserInput,
} from './auth.repository.interface.js';

import type { User } from './auth.schema.js';

export class InMemoryAuthRepository implements AuthRepository {
  private users: User[] = [];

  async create(input: CreateUserInput): Promise<User> {
    const user: User = {
      id: randomUUID(),
      ...input,
      createdAt: new Date().toISOString(),
    };

    this.users.push(user);

    return user;
  }

  async findByEmail(email: string): Promise<User | undefined> {
    return this.users.find((user) => user.email === email);
  }

  async findById(id: string): Promise<User | undefined> {
    return this.users.find((user) => user.id === id);
  }

  async findAll(): Promise<User[]> {
    return this.users;
  }

  async findStudentAccounts(input: {
    page: number;
    limit: number;
    search?: string;
    excludedUserIds: string[];
  }) {
    const search = input.search?.toLocaleLowerCase();
    const accounts = this.users
      .filter(
        (user) =>
          user.role === 'student' &&
          !input.excludedUserIds.includes(user.id) &&
          (!search ||
            user.name.toLocaleLowerCase().includes(search) ||
            user.email.toLocaleLowerCase().includes(search)),
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map(({ id, name, email }) => ({ id, name, email }));
    const startIndex = (input.page - 1) * input.limit;

    return {
      accounts: accounts.slice(startIndex, startIndex + input.limit),
      total: accounts.length,
    };
  }
}
