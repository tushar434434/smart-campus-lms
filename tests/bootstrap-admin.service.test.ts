import { describe, expect, it, vi } from 'vitest';
import { createBootstrapAdminService } from '../src/modules/admin/bootstrap-admin.service.js';

function setup(
  result:
    | 'promoted'
    | 'already-provisioned'
    | 'account-not-found'
    | 'invalid-credentials',
) {
  const repository = { promoteFirstAdmin: vi.fn().mockResolvedValue(result) };
  return {
    repository,
    service: createBootstrapAdminService(repository),
  };
}

describe('initial administrator bootstrap', () => {
  it('requires explicit enablement and the configured target email', async () => {
    const { repository, service } = setup('promoted');
    await expect(
      service.provision({
        enabled: false,
        configuredEmail: 'owner@example.test',
        email: 'owner@example.test',
        currentPassword: 'password',
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      service.provision({
        enabled: true,
        configuredEmail: 'owner@example.test',
        email: 'other@example.test',
        currentPassword: 'password',
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(repository.promoteFirstAdmin).not.toHaveBeenCalled();
  });

  it('promotes only after the repository validates the existing credentials', async () => {
    const { repository, service } = setup('promoted');
    await expect(
      service.provision({
        enabled: true,
        configuredEmail: ' Owner@Example.Test ',
        email: 'owner@example.test',
        currentPassword: 'verified-password',
      }),
    ).resolves.toBeUndefined();
    expect(repository.promoteFirstAdmin).toHaveBeenCalledWith(
      'owner@example.test',
      'verified-password',
    );
  });

  it.each([
    ['already-provisioned', 409, 'BOOTSTRAP_ALREADY_USED'],
    ['account-not-found', 404, 'BOOTSTRAP_ACCOUNT_NOT_FOUND'],
    ['invalid-credentials', 401, 'BOOTSTRAP_INVALID_CREDENTIALS'],
  ] as const)(
    'rejects the %s bootstrap result',
    async (result, statusCode, code) => {
      const { service } = setup(result);
      await expect(
        service.provision({
          enabled: true,
          configuredEmail: 'owner@example.test',
          email: 'owner@example.test',
          currentPassword: 'password',
        }),
      ).rejects.toMatchObject({ statusCode, code });
    },
  );
});
