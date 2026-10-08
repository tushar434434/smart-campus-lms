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
}