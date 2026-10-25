import { afterAll, describe, expect, it } from 'vitest';
import { createContainer } from '../src/container.js';

const enabled = process.env.RUN_DB_INTEGRATION === 'true';

describe.skipIf(!enabled)('PostgreSQL integration', () => {
  const container = createContainer();
  let courseId: string | undefined;

  afterAll(async () => {
    try {
      if (courseId) {
        await container.courseRepository.delete(courseId);
      }
    } finally {
      await container.prisma.$disconnect();
    }
  });

  it('creates, reads, and deletes a course in PostgreSQL', async () => {
    const code = `DBIT-${crypto.randomUUID().slice(0, 8)}`;

    const created = await container.courseRepository.create({
      title: 'PostgreSQL Integration Test',
      code,
      credits: 3,
    });

    courseId = created.id;

    const found = await container.courseRepository.findById(created.id);

    expect(found).toMatchObject({
      id: created.id,
      title: 'PostgreSQL Integration Test',
      code,
      credits: 3,
    });

    await expect(container.courseRepository.delete(created.id)).resolves.toBe(
      true,
    );

    courseId = undefined;
  });
});
