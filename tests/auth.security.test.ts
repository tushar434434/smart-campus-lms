import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createTestContainer } from '../src/test-container.js';

describe('authentication security', () => {
  const container = createTestContainer();
  const app = buildApp(container);

  beforeAll(async () => app.ready());
  afterAll(async () => app.close());

  it('forces public registration to create a student account', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        name: 'New Account',
        email: 'new-account@example.test',
        password: 'secure-password',
        role: 'admin',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data).toMatchObject({
      email: 'new-account@example.test',
      role: 'student',
    });
    expect(response.json().data).not.toHaveProperty('passwordHash');
  });

  it('uses the same generic forgot-password response for known and unknown accounts', async () => {
    container.passwordResetRepository.addAccount({
      id: 'reset-account',
      email: 'known@example.test',
      passwordHash: 'not-returned',
    });
    const request = (email: string) =>
      app.inject({
        method: 'POST',
        url: '/auth/forgot-password',
        payload: { email },
      });
    const [known, unknown] = await Promise.all([
      request('known@example.test'),
      request('unknown@example.test'),
    ]);

    expect(known.statusCode).toBe(200);
    expect(known.json()).toEqual(unknown.json());
    expect(known.json()).not.toHaveProperty('data');
    expect(known.body).not.toContain('not-returned');
  });

  it('rejects unauthenticated and non-admin access to role management', async () => {
    const unauthenticated = await app.inject({
      method: 'GET',
      url: '/admin/users',
    });
    expect(unauthenticated.statusCode).toBe(401);

    const student = await container.authRepository.create({
      name: 'Student Test',
      email: 'student-test@example.test',
      passwordHash: 'test-hash',
      role: 'student',
    });
    container.adminRepository.addAccount({
      id: student.id,
      name: student.name,
      email: student.email,
      role: student.role,
      createdAt: student.createdAt,
    });
    const token = app.jwt.sign({ sub: student.id, role: 'admin' });
    const forbidden = await app.inject({
      method: 'GET',
      url: '/admin/users',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(forbidden.statusCode).toBe(403);
  });

  it('allows current administrators to list users and validates role updates', async () => {
    const admin = await container.authRepository.create({
      name: 'Administrator Test',
      email: 'administrator-test@example.test',
      passwordHash: 'test-hash',
      role: 'admin',
    });
    const target = await container.authRepository.create({
      name: 'Target Test',
      email: 'target-test@example.test',
      passwordHash: 'test-hash',
      role: 'student',
    });
    for (const account of [admin, target]) {
      container.adminRepository.addAccount({
        id: account.id,
        name: account.name,
        email: account.email,
        role: account.role,
        createdAt: account.createdAt,
      });
    }
    const token = app.jwt.sign({ sub: admin.id, role: 'student' });
    const headers = { authorization: `Bearer ${token}` };
    const listed = await app.inject({
      method: 'GET',
      url: '/admin/users',
      headers,
    });
    expect(listed.statusCode).toBe(200);

    const invalidId = await app.inject({
      method: 'PATCH',
      url: '/admin/users/not-a-uuid/role',
      headers,
      payload: { role: 'faculty' },
    });
    expect(invalidId.statusCode).toBe(400);

    const invalidRole = await app.inject({
      method: 'PATCH',
      url: `/admin/users/${target.id}/role`,
      headers,
      payload: { role: 'owner' },
    });
    expect(invalidRole.statusCode).toBe(400);

    const updated = await app.inject({
      method: 'PATCH',
      url: `/admin/users/${target.id}/role`,
      headers,
      payload: { role: 'faculty' },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().data).toMatchObject({
      targetId: target.id,
      previousRole: 'student',
      newRole: 'faculty',
    });

    const missingTarget = await app.inject({
      method: 'PATCH',
      url: '/admin/users/00000000-0000-4000-8000-000000000001/role',
      headers,
      payload: { role: 'faculty' },
    });
    expect(missingTarget.statusCode).toBe(404);

    const audit = await app.inject({
      method: 'GET',
      url: '/admin/role-audit-logs',
      headers,
    });
    expect(audit.statusCode).toBe(200);
    expect(audit.json().data.logs[0]).toMatchObject({
      actorId: admin.id,
      targetId: target.id,
      previousRole: 'student',
      newRole: 'faculty',
    });
  });
});
