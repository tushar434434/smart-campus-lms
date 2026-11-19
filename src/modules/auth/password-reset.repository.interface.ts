export interface PasswordResetRecord {
  id: string;
  userId: string;
  otpHash: string;
  otpExpiresAt: Date;
  failedAttempts: number;
  resetTokenHash: string | null;
  resetTokenExpiresAt: Date | null;
  consumedAt: Date | null;
  createdAt: Date;
}

export interface PasswordResetRepository {
  findAccount(
    email: string,
  ): Promise<{ id: string; email: string } | undefined>;
  createReset(
    userId: string,
    otpHash: string,
    otpExpiresAt: Date,
    cooldownSince: Date,
  ): Promise<PasswordResetRecord | undefined>;
  findPendingReset(userId: string): Promise<PasswordResetRecord | undefined>;
  incrementFailedAttempts(
    resetId: string,
    expectedAttempts: number,
    now: Date,
  ): Promise<boolean>;
  verifyOtp(
    resetId: string,
    expectedAttempts: number,
    resetTokenHash: string,
    resetTokenExpiresAt: Date,
    now: Date,
  ): Promise<boolean>;
  resetPassword(
    resetTokenHash: string,
    passwordHash: string,
    now: Date,
  ): Promise<boolean>;
  invalidateReset(resetId: string, now: Date): Promise<void>;
}
