import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';
import bcrypt from 'bcrypt';
import { AppError } from '../../errors/app-error.js';
import type { PasswordResetMailer } from './email.service.js';
import type { PasswordResetRepository } from './password-reset.repository.interface.js';

const MAX_OTP_ATTEMPTS = 5;
const REQUEST_COOLDOWN_MS = 60_000;

export function createPasswordResetService(
  repository: PasswordResetRepository,
  mailer: PasswordResetMailer,
  options: {
    secret: string;
    ttlMinutes: number;
    logger?: { warn: (message: string) => void };
    now?: () => Date;
  },
) {
  const now = options.now ?? (() => new Date());
  if (!options.secret)
    throw new Error('Password reset signing secret is required');

  function otpDigest(userId: string, otp: string): string {
    return createHmac('sha256', options.secret)
      .update(`${userId}:${otp}`)
      .digest('hex');
  }

  return {
    async requestReset(email: string): Promise<void> {
      const normalizedEmail = email.trim().toLowerCase();
      const account = await repository.findAccount(normalizedEmail);
      if (!account) return;

      const issuedAt = now();
      const otp = randomInt(100_000, 1_000_000).toString();
      const digest = otpDigest(account.id, otp);
      const reset = await repository.createReset(
        account.id,
        digest,
        new Date(issuedAt.getTime() + options.ttlMinutes * 60_000),
        new Date(issuedAt.getTime() - REQUEST_COOLDOWN_MS),
      );
      if (!reset) return;

      try {
        await mailer.sendPasswordResetOtp(
          account.email,
          otp,
          options.ttlMinutes,
        );
      } catch {
        await repository.invalidateReset(reset.id, now());
        options.logger?.warn('Password reset email delivery failed');
      }
    },

    async verifyOtp(email: string, otp: string): Promise<string> {
      const account = await repository.findAccount(email.trim().toLowerCase());
      const reset = account
        ? await repository.findPendingReset(account.id)
        : undefined;
      const currentTime = now();
      if (
        !account ||
        !reset ||
        reset.consumedAt ||
        reset.resetTokenHash ||
        reset.otpExpiresAt <= currentTime ||
        reset.failedAttempts >= MAX_OTP_ATTEMPTS
      ) {
        throw new AppError(
          'Invalid or expired reset code',
          400,
          'INVALID_RESET_CODE',
        );
      }

      const submittedDigest = Buffer.from(otpDigest(account.id, otp), 'hex');
      const storedDigest = Buffer.from(reset.otpHash, 'hex');
      const valid =
        storedDigest.length === submittedDigest.length &&
        timingSafeEqual(storedDigest, submittedDigest);
      if (!valid) {
        const incremented = await repository.incrementFailedAttempts(
          reset.id,
          reset.failedAttempts,
          currentTime,
        );
        if (!incremented) {
          throw new AppError(
            'Invalid or expired reset code',
            400,
            'INVALID_RESET_CODE',
          );
        }
        throw new AppError(
          'Invalid or expired reset code',
          400,
          'INVALID_RESET_CODE',
        );
      }

      const resetToken = randomBytes(32).toString('base64url');
      const verified = await repository.verifyOtp(
        reset.id,
        reset.failedAttempts,
        createHash('sha256').update(resetToken).digest('hex'),
        new Date(currentTime.getTime() + options.ttlMinutes * 60_000),
        currentTime,
      );
      if (!verified) {
        throw new AppError(
          'Invalid or expired reset code',
          400,
          'INVALID_RESET_CODE',
        );
      }
      return resetToken;
    },

    async resetPassword(
      resetToken: string,
      newPassword: string,
    ): Promise<void> {
      const tokenHash = createHash('sha256').update(resetToken).digest('hex');
      const passwordHash = await bcrypt.hash(newPassword, 12);
      const updated = await repository.resetPassword(
        tokenHash,
        passwordHash,
        now(),
      );
      if (!updated) {
        throw new AppError(
          'Reset authorization is invalid or expired',
          400,
          'INVALID_RESET_TOKEN',
        );
      }
    },
  };
}
