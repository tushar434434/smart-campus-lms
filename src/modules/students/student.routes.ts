
import type { FastifyInstance } from 'fastify';

import { AppError } from '../../errors/app-error.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { successResponse } from '../../utils/response.js';

import {
  createStudentSchema,
  linkStudentUserSchema,
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
  app.post(
    '/students',
    {
      preHandler: [authenticate, authorize('faculty', 'admin')],
      schema: {
        tags: ['Students'],
        summary: 'Create a student',
        description: 'Creates a new student record.',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
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

      const student = await service.createStudent(result.data);

      return reply
        .status(201)
        .send(successResponse('Student created successfully', student));
    },
  );

  app.get(
    '/students',
    {
      preHandler: [authenticate, authorize('faculty', 'admin')],
      schema: {
        tags: ['Students'],
        summary: 'List students',
        description: 'Returns a paginated list of students with optional search.',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
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

      const data = await service.listStudents(result.data);

      return successResponse('Students retrieved successfully', data);
    },
  );

  app.get<{ Params: { id: string } }>(
    '/students/:id',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Students'],
        summary: 'Get student by ID',
        description:
          'Faculty/admin can view any student. Students can view their own linked record.',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const { id } = request.params;

      // Uses the request user shape already populated by authentication.
      const user = request.user as {
        sub: string;
        role: 'student' | 'faculty' | 'admin';
      };

      if (user.role === 'student') {
        const ownStudent = await service.getStudentByUserId(user.sub);

        if (ownStudent.id !== id) {
          throw new AppError(
            'You can only access your own student record',
            403,
            'FORBIDDEN',
          );
        }

        return successResponse('Student retrieved successfully', ownStudent);
      }

      if (user.role !== 'faculty' && user.role !== 'admin') {
        throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
      }

      const student = await service.getStudentById(id);

      return successResponse('Student retrieved successfully', student);
    },
  );

  app.patch<{ Params: { id: string } }>(
    '/students/:id',
    {
      preHandler: [authenticate, authorize('faculty', 'admin')],
      schema: {
        tags: ['Students'],
        summary: 'Update a student',
        description: 'Updates one or more fields of an existing student.',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const result = updateStudentSchema.safeParse(request.body);

      if (!result.success) {
        throw new AppError(
          result.error.issues.map((issue) => issue.message).join(', '),
          400,
          'VALIDATION_ERROR',
        );
      }

      const student = await service.updateStudent(
        request.params.id,
        result.data,
      );

      return reply.send(
        successResponse('Student updated successfully', student),
      );
    },
  );

  app.patch<{ Params: { id: string } }>(
    '/students/:id/link-user',
    {
      preHandler: [authenticate, authorize('faculty', 'admin')],
      schema: {
        tags: ['Students'],
        summary: 'Link student to user account',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const result = linkStudentUserSchema.safeParse(request.body);

      if (!result.success) {
        throw new AppError(
          result.error.issues.map((issue) => issue.message).join(', '),
          400,
          'VALIDATION_ERROR',
        );
      }

      const student = await service.linkStudentUser(
        request.params.id,
        result.data.userId,
      );

      return reply.send(
        successResponse(
          'Student linked to user account successfully',
          student,
        ),
      );
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/students/:id',
    {
      preHandler: [authenticate, authorize('admin')],
      schema: {
        tags: ['Students'],
        summary: 'Delete a student',
        description: 'Deletes a student using their ID.',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      await service.deleteStudent(request.params.id);

      return reply.status(204).send();
    },
  );
}
