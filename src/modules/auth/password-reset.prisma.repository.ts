import { PrismaClient } from '../../generated/prisma/client.js';
import type {
  PasswordResetRecord,
  PasswordResetRepository,
} from './password-reset.repository.interface.js';

export class PrismaPasswordResetRepository implements PasswordResetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAccount(email: string) {
    return (
      (await this.prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true },
      })) ?? undefined
    );
  }

  async createReset(
    userId: string,
    otpHash: string,
    otpExpiresAt: Date,
    cooldownSince: Date,
  ): Promise<PasswordResetRecord | undefined> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 493271))`;
      const recent = await transaction.passwordResetToken.findFirst({
        where: { userId, createdAt: { gte: cooldownSince } },
        select: { id: true },
      });
      if (recent) return undefined;
      await transaction.passwordResetToken.updateMany({
        where: { userId, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      return transaction.passwordResetToken.create({
        data: { userId, otpHash, otpExpiresAt },
      });
    });
  }

  async findPendingReset(
    userId: string,
  ): Promise<PasswordResetRecord | undefined> {
    return (
      (await this.prisma.passwordResetToken.findFirst({
        where: {
          userId,
          consumedAt: null,
          resetTokenHash: null,
        },
        orderBy: { createdAt: 'desc' },
      })) ?? undefined
    );
  }

  async incrementFailedAttempts(
    resetId: string,
    expectedAttempts: number,
    now: Date,
  ): Promise<boolean> {
    const result = await this.prisma.passwordResetToken.updateMany({
      where: {
        id: resetId,
        consumedAt: null,
        resetTokenHash: null,
        failedAttempts: expectedAttempts,
        otpExpiresAt: { gt: now },
      },
      data: { failedAttempts: { increment: 1 } },
    });
    return result.count === 1;
  }

  async verifyOtp(
    resetId: string,
    expectedAttempts: number,
    resetTokenHash: string,
    resetTokenExpiresAt: Date,
    now: Date,
  ): Promise<boolean> {
    const result = await this.prisma.passwordResetToken.updateMany({
      where: {
        id: resetId,
        consumedAt: null,
        resetTokenHash: null,
        failedAttempts: expectedAttempts,
        otpExpiresAt: { gt: now },
      },
      data: { resetTokenHash, resetTokenExpiresAt },
    });
    return result.count === 1;
  }

  async resetPassword(
    resetTokenHash: string,
    passwordHash: string,
    now: Date,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const reset = await transaction.passwordResetToken.findFirst({
        where: {
          resetTokenHash,
          resetTokenExpiresAt: { gt: now },
          consumedAt: null,
        },
        select: { id: true, userId: true },
      });
      if (!reset) return false;

      const consumed = await transaction.passwordResetToken.updateMany({
        where: {
          id: reset.id,
          resetTokenHash,
          resetTokenExpiresAt: { gt: now },
          consumedAt: null,
        },
        data: { consumedAt: now, resetTokenHash: null },
      });
      if (consumed.count !== 1) return false;

      await transaction.user.update({
        where: { id: reset.userId },
        data: { passwordHash },
      });
      await transaction.passwordResetToken.updateMany({
        where: { userId: reset.userId, consumedAt: null },
        data: { consumedAt: now, resetTokenHash: null },
      });
      return true;
    });
  }

  async invalidateReset(resetId: string, now: Date): Promise<void> {
    await this.prisma.passwordResetToken.updateMany({
      where: { id: resetId, consumedAt: null },
      data: { consumedAt: now },
    });
  }
}
