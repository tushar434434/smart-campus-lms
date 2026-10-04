import type { FastifyInstance } from 'fastify';

import { AppError } from '../../errors/app-error.js';
import { successResponse } from '../../utils/response.js';

import { createStudentSchema } from './student.schema.js';

import { createStudent, getStudentById } from './student.service.js';

export async function studentRoutes(app: FastifyInstance) {
  // Register a new student
  app.post('/students', async (request, reply) => {
    const result = createStudentSchema.safeParse(request.body);

    if (!result.success) {
      throw new AppError(
        result.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join(', '),
        400,
        'VALIDATION_ERROR',
      );
    }

    const student = createStudent(result.data);

    return reply
      .status(201)
      .send(successResponse('Student created successfully', student));
  });

  // Retrieve student by ID
  app.get<{ Params: { id: string } }>('/students/:id', async (request) => {
    const student = getStudentById(request.params.id);

    return successResponse('Student retrieved successfully', student);
  });
}
