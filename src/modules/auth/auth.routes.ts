import type { FastifyPluginAsync } from 'fastify';

import { successResponse } from '../../utils/response.js';
import { AppError } from '../../errors/app-error.js';

import { registerSchema, loginSchema } from './auth.schema.js';

import { authenticate } from '../../middleware/authenticate.js';

import type { createAuthService } from './auth.service.js';

type AuthService = ReturnType<typeof createAuthService>;

interface AuthRoutesOptions {
  service: AuthService;
}

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (
  app,
  options,
) => {
  const { service } = options;

  app.post('/register', async (request, reply) => {
    const result = registerSchema.safeParse(request.body);

    if (!result.success) {
      throw new AppError(
        result.error.issues[0]?.message ?? 'Invalid registration data',
        400,
        'VALIDATION_ERROR',
      );
    }

    const user = await service.register(result.data);

    return reply
      .code(201)
      .send(successResponse('User registered successfully', user));
  });

  app.post('/login', async (request, reply) => {
    const result = loginSchema.safeParse(request.body);

    if (!result.success) {
      throw new AppError(
        result.error.issues[0]?.message ?? 'Invalid login data',
        400,
        'VALIDATION_ERROR',
      );
    }

    const user = await service.login(result.data.email, result.data.password);

    const token = app.jwt.sign({
      sub: user.id,
      role: user.role,
    });

    return reply.send(
      successResponse('Login successful', {
        user,
        token,
      }),
    );
  });

  app.get('/me', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as { sub: string };

    const profile = service.getUserById(user.sub);

    return reply.send(
      successResponse('Profile retrieved successfully', profile),
    );
  });
};
