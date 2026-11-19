import { AppError } from '../../errors/app-error.js';

export type BootstrapAdminResult =
  | 'promoted'
  | 'already-provisioned'
  | 'account-not-found'
  | 'invalid-credentials';

export interface BootstrapAdminRepository {
  promoteFirstAdmin(
    email: string,
    currentPassword: string,
  ): Promise<BootstrapAdminResult>;
}

export function createBootstrapAdminService(
  repository: BootstrapAdminRepository,
) {
  return {
    async provision(input: {
      enabled: boolean;
      configuredEmail: string | undefined;
      email: string;
      currentPassword: string;
    }): Promise<void> {
      const email = input.email.trim().toLowerCase();
      const configuredEmail = input.configuredEmail?.trim().toLowerCase();
      if (!input.enabled || !configuredEmail || email !== configuredEmail) {
        throw new AppError(
          'Bootstrap is disabled or the target email is not authorized',
          403,
          'BOOTSTRAP_NOT_AUTHORIZED',
        );
      }

      const result = await repository.promoteFirstAdmin(
        email,
        input.currentPassword,
      );
      switch (result) {
        case 'promoted':
          return;
        case 'already-provisioned':
          throw new AppError(
            'An administrator already exists; bootstrap can only run once',
            409,
            'BOOTSTRAP_ALREADY_USED',
          );
        case 'account-not-found':
          throw new AppError(
            'The specified account does not exist; register it as a student first',
            404,
            'BOOTSTRAP_ACCOUNT_NOT_FOUND',
          );
        case 'invalid-credentials':
          throw new AppError(
            'The account password could not be verified',
            401,
            'BOOTSTRAP_INVALID_CREDENTIALS',
          );
      }
    },
  };
}
