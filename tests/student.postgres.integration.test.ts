import dotenv from 'dotenv';
import { afterAll, describe, expect, it } from 'vitest';
import { AppError } from '../src/errors/app-error.js';
import { createContainer } from '../src/container.js';

dotenv.config({ path: '.env.test', override: true });

const enabled = process.env.RUN_DB_INTEGRATION === 'true';

describe.skipIf(!enabled)(
  'Student account linking PostgreSQL integration',
  () => {
    const container = createContainer();
    const studentIds: string[] = [];
    const userIds: string[] = [];

    afterAll(async () => {
      try {
        if (studentIds.length > 0) {
          await container.prisma.student.deleteMany({
            where: { id: { in: studentIds } },
          });
        }
        if (userIds.length > 0) {
          await container.prisma.user.deleteMany({
            where: { id: { in: userIds } },
          });
        }
      } finally {
        await container.prisma.$disconnect();
      }
    });

    it('enforces one-to-one account linking for concurrent writes', async () => {
      const suffix = crypto.randomUUID();
      const createProfile = async (index: number) => {
        const student = await container.studentRepository.create({
          name: `Link Test Student ${index}`,
          email: `student-${index}-${suffix}@example.com`,
          enrollmentNumber: `LINK${suffix.replaceAll('-', '').slice(0, 20)}${index}`,
          department: 'Integration Testing',
          semester: 1,
        });
        studentIds.push(student.id);
        return student;
      };
      const createAccount = async (index: number) => {
        const user = await container.authRepository.create({
          name: `Link Test Account ${index}`,
          email: `account-${index}-${suffix}@example.com`,
          passwordHash: 'integration-test-hash',
          role: 'student',
        });
        userIds.push(user.id);
        return user;
      };

      const [firstProfile, thirdProfile, fourthProfile] = await Promise.all([
        createProfile(1),
        createProfile(2),
        createProfile(3),
      ]);
      const [firstAccount, secondAccount, thirdAccount] = await Promise.all([
        createAccount(1),
        createAccount(2),
        createAccount(3),
      ]);

      const sameProfileResults = await Promise.all([
        container.studentRepository.linkUser(firstProfile.id, firstAccount.id),
        container.studentRepository.linkUser(firstProfile.id, secondAccount.id),
      ]);

      expect(sameProfileResults.filter(Boolean)).toHaveLength(1);
      expect(
        sameProfileResults.filter((result) => result === undefined),
      ).toHaveLength(1);

      const sameAccountResults = await Promise.allSettled([
        container.studentRepository.linkUser(thirdProfile.id, thirdAccount.id),
        container.studentRepository.linkUser(fourthProfile.id, thirdAccount.id),
      ]);

      expect(
        sameAccountResults.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      const conflict = sameAccountResults.find(
        (result) => result.status === 'rejected',
      );
      expect(conflict?.status).toBe('rejected');
      if (conflict?.status === 'rejected') {
        expect(conflict.reason).toBeInstanceOf(AppError);
        expect(conflict.reason).toMatchObject({
          statusCode: 409,
          code: 'USER_ALREADY_LINKED',
        });
      }
    });
  },
);
