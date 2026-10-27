import { randomUUID } from 'node:crypto';
import type {
  PasswordResetRecord,
  PasswordResetRepository,
} from './password-reset.repository.interface.js';

interface Account {
  id: string;
  email: string;
  passwordHash: string;
}

export class InMemoryPasswordResetRepository implements PasswordResetRepository {
  private readonly accounts = new Map<string, Account>();
  private readonly resets = new Map<string, PasswordResetRecord>();

  addAccount(account: Account): void {
    this.accounts.set(account.email.toLowerCase(), account);
  }

  async findAccount(email: string) {
    const account = this.accounts.get(email.toLowerCase());
    return account ? { id: account.id, email: account.email } : undefined;
  }

  async createReset(
    userId: string,
    otpHash: string,
    otpExpiresAt: Date,
    cooldownSince: Date,
  ): Promise<PasswordResetRecord | undefined> {
    const createdAt = new Date();
    if (
      [...this.resets.values()].some(
        (reset) => reset.userId === userId && reset.createdAt >= cooldownSince,
      )
    )
      return undefined;
    for (const reset of this.resets.values()) {
      if (reset.userId === userId && !reset.consumedAt)
        reset.consumedAt = createdAt;
    }
    const record: PasswordResetRecord = {
      id: randomUUID(),
      userId,
      otpHash,
      otpExpiresAt,
      failedAttempts: 0,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      consumedAt: null,
      createdAt,
    };
    this.resets.set(record.id, record);
    return record;
  }

  async findPendingReset(
    userId: string,
  ): Promise<PasswordResetRecord | undefined> {
    return [...this.resets.values()]
      .filter(
        (reset) =>
          reset.userId === userId && !reset.consumedAt && !reset.resetTokenHash,
      )
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      )[0];
  }

  async incrementFailedAttempts(
    resetId: string,
    expectedAttempts: number,
    now: Date,
  ): Promise<boolean> {
    const reset = this.resets.get(resetId);
    if (
      !reset ||
      reset.consumedAt ||
      reset.resetTokenHash ||
      reset.failedAttempts !== expectedAttempts ||
      reset.otpExpiresAt <= now
    )
      return false;
    reset.failedAttempts += 1;
    return true;
  }

  async verifyOtp(
    resetId: string,
    expectedAttempts: number,
    resetTokenHash: string,
    resetTokenExpiresAt: Date,
    now: Date,
  ): Promise<boolean> {
    const reset = this.resets.get(resetId);
    if (
      !reset ||
      reset.consumedAt ||
      reset.resetTokenHash ||
      reset.failedAttempts !== expectedAttempts ||
      reset.otpExpiresAt <= now
    )
      return false;
    reset.resetTokenHash = resetTokenHash;
    reset.resetTokenExpiresAt = resetTokenExpiresAt;
    return true;
  }

  async resetPassword(
    resetTokenHash: string,
    passwordHash: string,
    now: Date,
  ): Promise<boolean> {
    const reset = [...this.resets.values()].find(
      (item) =>
        item.resetTokenHash === resetTokenHash &&
        item.resetTokenExpiresAt &&
        item.resetTokenExpiresAt > now &&
        !item.consumedAt,
    );
    if (!reset) return false;
    const account = [...this.accounts.values()].find(
      (item) => item.id === reset.userId,
    );
    if (!account) return false;
    account.passwordHash = passwordHash;
    for (const item of this.resets.values()) {
      if (item.userId === reset.userId && !item.consumedAt) {
        item.consumedAt = now;
        item.resetTokenHash = null;
      }
    }
    return true;
  }

  async invalidateReset(resetId: string, now: Date): Promise<void> {
    const reset = this.resets.get(resetId);
    if (reset && !reset.consumedAt) reset.consumedAt = now;
  }
}
