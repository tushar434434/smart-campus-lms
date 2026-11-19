import { PrismaClient } from '../../generated/prisma/client.js';

import type { User } from './auth.schema.js';
import type {
  AuthRepository,
  CreateUserInput,
} from './auth.repository.interface.js';

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateUserInput): Promise<User> {
    const user = await this.prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
        role: input.role,
      },
    });

    return this.toUser(user);
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) return undefined;

    return this.toUser(user);
  }

  async findById(id: string): Promise<User | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) return undefined;

    return this.toUser(user);
  }

  async findAll(): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return users.map((user) => this.toUser(user));
  }

  async findStudentAccounts(input: {
    page: number;
    limit: number;
    search?: string;
    excludedUserIds: string[];
  }) {
    const where = {
      role: 'student' as const,
      ...(input.excludedUserIds.length > 0
        ? { id: { notIn: input.excludedUserIds } }
        : {}),
      ...(input.search
        ? {
            OR: [
              {
                name: { contains: input.search, mode: 'insensitive' as const },
              },
              {
                email: { contains: input.search, mode: 'insensitive' as const },
              },
            ],
          }
        : {}),
    };
    const [accounts, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: { id: true, name: true, email: true },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { accounts, total };
  }

  async updateName(id: string, name: string): Promise<User | undefined> {
    try {
      return this.toUser(
        await this.prisma.user.update({
          where: { id },
          data: { name },
        }),
      );
    } catch {
      return undefined;
    }
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<boolean> {
    const result = await this.prisma.user.updateMany({
      where: { id },
      data: { passwordHash },
    });
    return result.count > 0;
  }

  async setSuspendedAt(
    id: string,
    suspendedAt: string | null,
  ): Promise<User | undefined> {
    try {
      return this.toUser(
        await this.prisma.user.update({
          where: { id },
          data: { suspendedAt: suspendedAt ? new Date(suspendedAt) : null },
        }),
      );
    } catch {
      return undefined;
    }
  }

  private toUser(user: {
    id: string;
    name: string;
    email: string;
    passwordHash: string;
    role: 'student' | 'faculty' | 'admin';
    suspendedAt: Date | null;
    createdAt: Date;
  }): User {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      passwordHash: user.passwordHash,
      role: user.role,
      suspendedAt: user.suspendedAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
