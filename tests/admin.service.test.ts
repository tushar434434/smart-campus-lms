import { describe, expect, it } from 'vitest';
import { AppError } from '../src/errors/app-error.js';
import { InMemoryAdminRepository } from '../src/modules/admin/admin.repository.js';
import { createAdminService } from '../src/modules/admin/admin.service.js';

function setup() {
  const repository = new InMemoryAdminRepository();
  const now = new Date().toISOString();
  repository.addAccount({
    id: 'admin-1',
    name: 'Admin One',
    email: 'one@example.test',
    role: 'admin',
    createdAt: now,
  });
  repository.addAccount({
    id: 'admin-2',
    name: 'Admin Two',
    email: 'two@example.test',
    role: 'admin',
    createdAt: now,
  });
  repository.addAccount({
    id: 'student-1',
    name: 'Student One',
    email: 'student@example.test',
    role: 'student',
    createdAt: now,
  });
  return { repository, service: createAdminService(repository) };
}

describe('admin role management', () => {
  it('requires the current account role to be admin', async () => {
    const { service } = setup();
    await expect(service.requireAdmin('missing')).rejects.toMatchObject({
      statusCode: 401,
    });
    await expect(service.requireAdmin('student-1')).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('records authorized role changes without returning secret fields', async () => {
    const { service } = setup();
    const audit = await service.changeRole('admin-1', 'student-1', 'faculty');
    expect(audit).toMatchObject({
      actorId: 'admin-1',
      targetId: 'student-1',
      previousRole: 'student',
      newRole: 'faculty',
    });
    expect(audit).not.toHaveProperty('passwordHash');
  });

  it('blocks self-demotion and preserving the last administrator', async () => {
    const { service } = setup();
    await expect(
      service.changeRole('admin-1', 'admin-1', 'student'),
    ).rejects.toMatchObject({ statusCode: 400, code: 'SELF_DEMOTION' });

    await service.changeRole('admin-1', 'admin-2', 'faculty');
    await expect(
      service.changeRole('admin-1', 'admin-1', 'faculty'),
    ).rejects.toMatchObject({ statusCode: 400, code: 'SELF_DEMOTION' });
  });

  it('prevents concurrent demotions from removing every administrator', async () => {
    const { service } = setup();
    const outcomes = await Promise.allSettled([
      service.changeRole('admin-1', 'admin-2', 'faculty'),
      service.changeRole('admin-2', 'admin-1', 'faculty'),
    ]);
    expect(
      outcomes.filter((outcome) => outcome.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
    expect(rejected?.status).toBe('rejected');
    if (rejected?.status === 'rejected') {
      expect(rejected.reason).toBeInstanceOf(AppError);
      expect(['LAST_ADMIN_REQUIRED', 'FORBIDDEN']).toContain(
        rejected.reason.code,
      );
    }
    const { users } = await service.listUsers({ page: 1, limit: 10 });
    expect(users.filter((account) => account.role === 'admin')).toHaveLength(1);
  });
});
