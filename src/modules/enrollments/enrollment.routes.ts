import type { FastifyInstance } from 'fastify';

import { AppError } from '../../errors/app-error.js';
import { successResponse } from '../../utils/response.js';

import { createEnrollmentSchema } from './enrollment.schema.js';

import type { createEnrollmentService } from './enrollment.service.js';

type EnrollmentRoutesOptions = {
  service: ReturnType<typeof createEnrollmentService>;
};

export async function enrollmentRoutes(
  app: FastifyInstance,
  { service }: EnrollmentRoutesOptions,
) {
  // Create enrollment
  app.post(
    '/enrollments',
    {
      schema: {
        tags: ['Enrollments'],
        summary: 'Enroll a student',
        description: 'Enrolls a student in a course.',

        body: {
          type: 'object',
          required: ['studentId', 'courseId'],
          properties: {
            studentId: {
              type: 'string',
              format: 'uuid',
            },
            courseId: {
              type: 'string',
              format: 'uuid',
            },
          },
        },

        response: {
          201: {
            description: 'Student enrolled successfully',
            type: 'object',
            additionalProperties: true,
          },
          400: {
            description: 'Invalid enrollment data',
            type: 'object',
            additionalProperties: true,
          },
          404: {
            description: 'Student or course not found',
            type: 'object',
            additionalProperties: true,
          },
          409: {
            description: 'Student is already enrolled in the course',
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
    async (request, reply) => {
      const result = createEnrollmentSchema.safeParse(request.body);

      if (!result.success) {
        throw new AppError(
          result.error.issues.map((issue) => issue.message).join(', '),
          400,
          'VALIDATION_ERROR',
        );
      }

      const enrollment = await service.enrollStudent(
        result.data.studentId,
        result.data.courseId,
      );

      return reply
        .status(201)
        .send(successResponse('Student enrolled successfully', enrollment));
    },
  );

  // Get student enrollments
  app.get<{ Params: { studentId: string } }>(
    '/enrollments/student/:studentId',
    {
      schema: {
        tags: ['Enrollments'],
        summary: 'Get student enrollments',
        description: 'Returns all course enrollments for a student.',

        params: {
          type: 'object',
          required: ['studentId'],
          properties: {
            studentId: {
              type: 'string',
              format: 'uuid',
            },
          },
        },

        response: {
          200: {
            description: 'Student enrollments retrieved successfully',
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
      const enrollments = await service.getStudentEnrollments(
        request.params.studentId,
      );

      return successResponse(
        'Student enrollments retrieved successfully',
        enrollments,
      );
    },
  );

  // Delete enrollment
  app.delete<{ Params: { id: string } }>(
    '/enrollments/:id',
    {
      schema: {
        tags: ['Enrollments'],
        summary: 'Delete an enrollment',
        description: 'Removes a student enrollment.',

        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
          },
        },

        response: {
          204: {
            description: 'Enrollment deleted successfully',
          },
          404: {
            description: 'Enrollment not found',
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
    async (request, reply) => {
      await service.deleteEnrollment(request.params.id);

      return reply.status(204).send();
    },
  );
}
