import { randomUUID } from 'node:crypto';

import type {
  AuthRepository,
  CreateUserInput,
} from './auth.repository.interface.js';

import type { User } from './auth.schema.js';

export class InMemoryAuthRepository implements AuthRepository {
  private users: User[] = [];

  create(input: CreateUserInput): User {
    const user: User = {
      id: randomUUID(),
      ...input,
      createdAt: new Date().toISOString(),
    };

    this.users.push(user);

    return user;
  }

  findByEmail(email: string): User | undefined {
    return this.users.find((user) => user.email === email);
  }

  findById(id: string): User | undefined {
    return this.users.find((user) => user.id === id);
  }

  findAll(): User[] {
    return this.users;
  }
}
