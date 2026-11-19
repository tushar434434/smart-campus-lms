import bcrypt from 'bcrypt';
import { describe, expect, it } from 'vitest';
import { InMemoryAuthRepository } from '../src/modules/auth/auth.repository.js';
import { createAuthService } from '../src/modules/auth/auth.service.js';

describe('auth service account lifecycle', () => {
  it('rejects login for a suspended account after a valid password', async () => {
    const repository = new InMemoryAuthRepository();
    const service = createAuthService(repository);
    const passwordHash = await bcrypt.hash('secure-password', 4);
    const user = await repository.create({
      name: 'Suspended User',
      email: 'suspended@example.test',
      passwordHash,
      role: 'student',
    });
    await repository.setSuspendedAt(user.id, new Date().toISOString());

    await expect(
      service.login('suspended@example.test', 'secure-password'),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'ACCOUNT_SUSPENDED',
    });
  });

  it('updates the display name and rejects an incorrect current password', async () => {
    const repository = new InMemoryAuthRepository();
    const service = createAuthService(repository);
    const created = await service.register({
      name: 'Profile User',
      email: 'profile@example.test',
      password: 'secure-password',
    });
    const updated = await service.updateProfile(created.id, {
      name: 'Updated Name',
    });
    expect(updated.name).toBe('Updated Name');
    expect(updated).not.toHaveProperty('passwordHash');

    await expect(
      service.changePassword(created.id, {
        currentPassword: 'wrong-password',
        newPassword: 'new-secure-password',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_CURRENT_PASSWORD',
    });

    await service.changePassword(created.id, {
      currentPassword: 'secure-password',
      newPassword: 'new-secure-password',
    });
    await expect(
      service.login('profile@example.test', 'new-secure-password'),
    ).resolves.toMatchObject({ name: 'Updated Name' });
  });
});
