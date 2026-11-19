import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';

import { ZodError } from 'zod';
import { AppError } from './app-error.js';

export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  request.log.error(error);

  // Application errors
  if (error instanceof AppError) {
    reply.code(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  // Zod validation errors
  if (error instanceof ZodError) {
    reply.code(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  // Fastify JSON-schema validation errors
  if ('validation' in error && Array.isArray(error.validation)) {
    reply.code(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
      },
    });
    return;
  }

  if (
    'code' in error &&
    typeof error.code === 'string' &&
    (error.code === 'P2021' || error.code === 'P2022')
  ) {
    reply.code(503).send({
      success: false,
      error: {
        code: 'DATABASE_SCHEMA_OUTDATED',
        message:
          'The database schema is out of date. Run prisma migrate deploy from backend/ and retry.',
      },
    });
    return;
  }

  // Unexpected errors
  reply.code(500).send({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}
