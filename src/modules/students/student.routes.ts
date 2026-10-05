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
  // Create student
  app.post(
    '/students',
    {
      schema: {
        tags: ['Students'],
        summary: 'Create a student',
        description: 'Creates a new student record.',

        body: {
          type: 'object',
          required: [
            'name',
            'email',
            'enrollmentNumber',
            'department',
            'semester',
          ],
          properties: {
            name: {
              type: 'string',
              minLength: 3,
            },
            email: {
              type: 'string',
              format: 'email',
            },
            enrollmentNumber: {
              type: 'string',
              minLength: 5,
            },
            department: {
              type: 'string',
              minLength: 2,
            },
            semester: {
              type: 'integer',
              minimum: 1,
              maximum: 8,
            },
          },
        },

        response: {
          201: {
            description: 'Student created successfully',
            type: 'object',
            additionalProperties: true,
          },
          400: {
            description: 'Invalid student data',
            type: 'object',
            additionalProperties: true,
          },
        },
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

      const student = service.createStudent(result.data);

      return reply
        .status(201)
        .send(successResponse('Student created successfully', student));
    },
  );

  // List students
  app.get(
    '/students',
    {
      schema: {
        tags: ['Students'],
        summary: 'List students',
        description:
          'Returns a paginated list of students with optional search.',

        querystring: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              minimum: 1,
              default: 1,
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 10,
            },
            search: {
              type: 'string',
            },
          },
        },

        response: {
          200: {
            description: 'Students retrieved successfully',
            type: 'object',
            additionalProperties: true,
          },
          400: {
            description: 'Invalid query parameters',
            type: 'object',
            additionalProperties: true,
          },
        },
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

      const data = service.listStudents(result.data);

      return successResponse('Students retrieved successfully', data);
    },
  );

  // Get student by ID
  app.get<{ Params: { id: string } }>(
    '/students/:id',
    {
      schema: {
        tags: ['Students'],
        summary: 'Get student by ID',
        description: 'Returns a single student using their ID.',

        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
            },
          },
        },

        response: {
          200: {
            description: 'Student retrieved successfully',
            type: 'object',
            additionalProperties: true,
          },
          404: {
            description: 'Student not found',
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
    async (request) => {
      const student = service.getStudentById(request.params.id);

      return successResponse('Student retrieved successfully', student);
    },
  );

  // Update student
  app.patch<{ Params: { id: string } }>(
    '/students/:id',
    {
      schema: {
        tags: ['Students'],
        summary: 'Update a student',
        description:
          'Updates one or more fields of an existing student.',

        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
            },
          },
        },

        body: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              minLength: 3,
            },
            email: {
              type: 'string',
              format: 'email',
            },
            enrollmentNumber: {
              type: 'string',
              minLength: 5,
            },
            department: {
              type: 'string',
              minLength: 2,
            },
            semester: {
              type: 'integer',
              minimum: 1,
              maximum: 8,
            },
          },
        },

        response: {
          200: {
            description: 'Student updated successfully',
            type: 'object',
            additionalProperties: true,
          },
          400: {
            description: 'Invalid student data',
            type: 'object',
            additionalProperties: true,
          },
          404: {
            description: 'Student not found',
            type: 'object',
            additionalProperties: true,
          },
        },
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

      const student = service.updateStudent(request.params.id, result.data);

      return reply.send(
        successResponse('Student updated successfully', student),
      );
    },
  );

  // Delete student
  app.delete<{ Params: { id: string } }>(
    '/students/:id',
    {
      schema: {
        tags: ['Students'],
        summary: 'Delete a student',
        description: 'Deletes a student using their ID.',

        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
            },
          },
        },

        response: {
          204: {
            description: 'Student deleted successfully',
          },
          404: {
            description: 'Student not found',
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
    async (request, reply) => {
      service.deleteStudent(request.params.id);

      return reply.status(204).send();
    },
  );
}