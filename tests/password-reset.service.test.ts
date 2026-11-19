import { describe, expect, it, vi } from 'vitest';
import { InMemoryPasswordResetRepository } from '../src/modules/auth/password-reset.repository.js';
import { createPasswordResetService } from '../src/modules/auth/password-reset.service.js';

function setup() {
  const repository = new InMemoryPasswordResetRepository();
  repository.addAccount({
    id: 'account-1',
    email: 'learner@example.test',
    passwordHash: 'old-hash',
  });
  let now = new Date();
  let deliveredOtp = '';
  const sendPasswordResetOtp = vi.fn(async (_email: string, otp: string) => {
    deliveredOtp = otp;
  });
  const service = createPasswordResetService(
    repository,
    { sendPasswordResetOtp },
    {
      secret: 'unit-test-password-reset-secret',
      ttlMinutes: 10,
      now: () => now,
    },
  );
  return {
    repository,
    service,
    sendPasswordResetOtp,
    otp: () => deliveredOtp,
    advance: (milliseconds: number) => {
      now = new Date(now.getTime() + milliseconds);
    },
  };
}

describe('password reset service', () => {
  it('keeps account discovery generic and only sends six-digit OTPs by mail', async () => {
    const { service, sendPasswordResetOtp, otp } = setup();
    await expect(
      service.requestReset('unknown@example.test'),
    ).resolves.toBeUndefined();
    expect(sendPasswordResetOtp).not.toHaveBeenCalled();
    await expect(
      service.requestReset('learner@example.test'),
    ).resolves.toBeUndefined();
    expect(sendPasswordResetOtp).toHaveBeenCalledOnce();
    expect(otp()).toMatch(/^\d{6}$/);
  });

  it('enforces the failed-attempt limit and one-time reset authorization', async () => {
    const { service, otp, advance } = setup();
    await service.requestReset('learner@example.test');
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        service.verifyOtp('learner@example.test', '000000'),
      ).rejects.toMatchObject({ code: 'INVALID_RESET_CODE' });
    }
    await expect(
      service.verifyOtp('learner@example.test', otp()),
    ).rejects.toMatchObject({ code: 'INVALID_RESET_CODE' });

    advance(61_000);
    await service.requestReset('learner@example.test');
    const resetToken = await service.verifyOtp('learner@example.test', otp());
    await service.resetPassword(resetToken, 'new-secure-password');
    await expect(
      service.resetPassword(resetToken, 'reused-token-password'),
    ).rejects.toMatchObject({ code: 'INVALID_RESET_TOKEN' });
    await expect(
      service.verifyOtp('learner@example.test', otp()),
    ).rejects.toMatchObject({ code: 'INVALID_RESET_CODE' });
  });

  it('expires OTPs and reset authorization', async () => {
    const { service, otp, advance } = setup();
    await service.requestReset('learner@example.test');
    advance(10 * 60_000 + 1);
    await expect(
      service.verifyOtp('learner@example.test', otp()),
    ).rejects.toMatchObject({ code: 'INVALID_RESET_CODE' });
  });

  it('does not expose mail provider errors or log sensitive information', async () => {
    const repository = new InMemoryPasswordResetRepository();
    repository.addAccount({
      id: 'id-2',
      email: 'failure@example.test',
      passwordHash: 'hash',
    });
    const logger = { warn: vi.fn() };
    const mailer = {
      sendPasswordResetOtp: vi
        .fn()
        .mockRejectedValue(new Error('smtp credential detail')),
    };
    const service = createPasswordResetService(repository, mailer, {
      secret: 'unit-test-password-reset-secret',
      ttlMinutes: 10,
      logger,
    });
    await expect(
      service.requestReset('failure@example.test'),
    ).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      'Password reset email delivery failed',
    );
    expect(logger.warn.mock.calls.flat().join(' ')).not.toContain('credential');
  });
});
