import type { FastifyInstance } from 'fastify';

import { AppError } from '../../errors/app-error.js';
import { successResponse } from '../../utils/response.js';

import { createStudentSchema, listStudentsSchema } from './student.schema.js';

import {
  createStudent,
  getStudentById,
  listStudents,
} from './student.service.js';

export async function studentRoutes(app: FastifyInstance) {
  // Register a student
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

  // List students with pagination and search
  app.get('/students', async (request) => {
    const result = listStudentsSchema.safeParse(request.query);

    if (!result.success) {
      throw new AppError(
        result.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join(', '),
        400,
        'VALIDATION_ERROR',
      );
    }

    const data = listStudents(result.data);

    return successResponse('Students retrieved successfully', data);
  });

  // Retrieve a student by ID
  app.get<{ Params: { id: string } }>('/students/:id', async (request) => {
    const student = getStudentById(request.params.id);

    return successResponse('Student retrieved successfully', student);
  });
}
