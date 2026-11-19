import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PrismaCourseRepository } from '../src/modules/courses/course.prisma.repository.js';

const { mockUpdate, mockDelete } = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('../src/generated/prisma/client.js', () => ({
  PrismaClient: class {},
}));

describe('PrismaCourseRepository error handling', () => {
  let repository: PrismaCourseRepository;

  beforeEach(() => {
    vi.clearAllMocks();

    repository = new PrismaCourseRepository({
      course: {
        update: mockUpdate,
        delete: mockDelete,
      },
    } as never);
  });

  it('returns undefined when updating a nonexistent course', async () => {
    mockUpdate.mockRejectedValue({ code: 'P2025' });

    await expect(
      repository.update('missing-id', { title: 'Updated Course' }),
    ).resolves.toBeUndefined();
  });

  it('rethrows unexpected update errors', async () => {
    const error = new Error('Database connection failed');
    mockUpdate.mockRejectedValue(error);

    await expect(
      repository.update('course-1', { title: 'Updated Course' }),
    ).rejects.toBe(error);
  });

  it('returns false when deleting a nonexistent course', async () => {
    mockDelete.mockRejectedValue({ code: 'P2025' });

    await expect(repository.delete('missing-id')).resolves.toBe(false);
  });

  it('rethrows unexpected delete errors', async () => {
    const error = new Error('Database connection failed');
    mockDelete.mockRejectedValue(error);

    await expect(repository.delete('course-1')).rejects.toBe(error);
  });
});
