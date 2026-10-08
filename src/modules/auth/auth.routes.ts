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

  // POST /auth/register
  app.post(
    '/register',
    {
      schema: {
        tags: ['Authentication'],
        summary: 'Register a new user',
        description: 'Creates a new student or faculty account.',

        body: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            name: {
              type: 'string',
              minLength: 2,
            },
            email: {
              type: 'string',
              format: 'email',
            },
            password: {
              type: 'string',
              minLength: 8,
            },
            role: {
              type: 'string',
              enum: ['student', 'faculty'],
              default: 'student',
            },
          },
        },

        response: {
          201: {
            description: 'User registered successfully',
            type: 'object',
            additionalProperties: true,
          },
          400: {
            description: 'Invalid registration data',
            type: 'object',
            additionalProperties: true,
          },
          409: {
            description: 'Email already exists',
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
    async (request, reply) => {
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
    },
  );

  // POST /auth/login
  app.post(
    '/login',
    {
      schema: {
        tags: ['Authentication'],
        summary: 'Login user',
        description: 'Authenticates a user and returns a JWT token.',

        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
            },
            password: {
              type: 'string',
              minLength: 8,
            },
          },
        },

        response: {
          200: {
            description: 'Login successful',
            type: 'object',
            additionalProperties: true,
          },
          400: {
            description: 'Invalid login data',
            type: 'object',
            additionalProperties: true,
          },
          401: {
            description: 'Invalid email or password',
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
    async (request, reply) => {
      const result = loginSchema.safeParse(request.body);

      if (!result.success) {
        throw new AppError(
          result.error.issues[0]?.message ?? 'Invalid login data',
          400,
          'VALIDATION_ERROR',
        );
      }

      const user = await service.login(
        result.data.email,
        result.data.password,
      );

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
    },
  );

  // GET /auth/me
  app.get(
    '/me',
    {
      preHandler: authenticate,

      schema: {
        tags: ['Authentication'],
        summary: 'Get current user',
        description: 'Returns the profile of the authenticated user.',

        security: [
          {
            bearerAuth: [],
          },
        ],

        response: {
          200: {
            description: 'Profile retrieved successfully',
            type: 'object',
            additionalProperties: true,
          },
          401: {
            description: 'Authentication required',
            type: 'object',
            additionalProperties: true,
          },
          404: {
            description: 'User not found',
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { sub: string };

      const profile = await service.getUserById(user.sub);

      return reply.send(
        successResponse('Profile retrieved successfully', profile),
      );
    },
  );
};