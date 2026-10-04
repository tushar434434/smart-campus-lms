import type { FastifyInstance } from 'fastify';

import { AppError } from '../../errors/app-error.js';
import { successResponse } from '../../utils/response.js';

import {
  createStudentSchema,
  listStudentsSchema,
  updateStudentSchema,
} from './student.schema.js';

import type { createStudentService } from './student.service.js';

type StudentRoutesOptions = {
  service: ReturnType<typeof createStudentService>;
};

export async function studentRoutes(
  app: FastifyInstance,
  { service }: StudentRoutesOptions,
) {
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

    const student = service.createStudent(result.data);

    return reply
      .status(201)
      .send(successResponse('Student created successfully', student));
  });

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

    const data = service.listStudents(result.data);

    return successResponse('Students retrieved successfully', data);
  });

  app.get<{ Params: { id: string } }>('/students/:id', async (request) => {
    const student = service.getStudentById(request.params.id);

    return successResponse('Student retrieved successfully', student);
  });

  app.patch<{ Params: { id: string } }>(
    '/students/:id',
    async (request, reply) => {
      const result = updateStudentSchema.safeParse(request.body);

      if (!result.success) {
        throw new AppError(
          result.error.issues.map((issue) => issue.message).join(', '),
          400,
          'VALIDATION_ERROR',
        );
      }

      const student = service.updateStudent(request.params.id, result.data);

      return reply.send(
        successResponse('Student updated successfully', student),
      );
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/students/:id',
    async (request, reply) => {
      service.deleteStudent(request.params.id);

      return reply.status(204).send();
    },
  );
}
