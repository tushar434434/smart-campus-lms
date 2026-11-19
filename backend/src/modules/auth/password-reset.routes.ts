import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError } from '../../errors/app-error.js';
import { successResponse } from '../../utils/response.js';
import type { createPasswordResetService } from './password-reset.service.js';

type PasswordResetService = ReturnType<typeof createPasswordResetService>;

const requestSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
});
const verifySchema = requestSchema.extend({
  otp: z.string().regex(/^\d{6}$/, 'Enter the six-digit code'),
});
const resetSchema = z.object({
  resetToken: z.string().min(32).max(128),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

function invalidBody(error: z.ZodError): AppError {
  return new AppError(
    error.issues.map((issue) => issue.message).join(', '),
    400,
    'VALIDATION_ERROR',
  );
}

export async function passwordResetRoutes(
  app: FastifyInstance,
  service: PasswordResetService,
) {
  app.post(
    '/auth/forgot-password',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request) => {
      const body = requestSchema.safeParse(request.body);
      if (!body.success) throw invalidBody(body.error);
      await service.requestReset(body.data.email);
      return successResponse(
        'If an account exists for that email, a reset code will be sent.',
        undefined,
      );
    },
  );

  app.post(
    '/auth/verify-reset-otp',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request) => {
      const body = verifySchema.safeParse(request.body);
      if (!body.success) throw invalidBody(body.error);
      const resetToken = await service.verifyOtp(
        body.data.email,
        body.data.otp,
      );
      return successResponse('Reset code verified', { resetToken });
    },
  );

  app.post(
    '/auth/reset-password',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request) => {
      const body = resetSchema.safeParse(request.body);
      if (!body.success) throw invalidBody(body.error);
      await service.resetPassword(body.data.resetToken, body.data.newPassword);
      return successResponse('Password reset successfully', undefined);
    },
  );
}
