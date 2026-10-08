import type { FastifyInstance } from 'fastify';

import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { successResponse } from '../../utils/response.js';

import {
  createAssignmentSchema,
  updateAssignmentSchema,
} from './assignment.schema.js';

import type { createAssignmentService } from './assignment.service.js';

type AssignmentRoutesOptions = {
  service: ReturnType<typeof createAssignmentService>;
};

export async function assignmentRoutes(
  app: FastifyInstance,
  { service }: AssignmentRoutesOptions,
) {
  // Create assignment: Faculty and Admin only
  app.post(
    '/assignments',
    {
      preHandler: [authenticate, authorize('faculty', 'admin')],
      schema: {
        tags: ['Assignments'],
        summary: 'Create an assignment',
        description:
          'Creates a new assignment for a course. Faculty and admin users only.',
        security: [{ bearerAuth: [] }],

        body: {
          type: 'object',
          required: ['courseId', 'title', 'description', 'dueAt', 'maxMarks'],
          properties: {
            courseId: {
              type: 'string',
              format: 'uuid',
            },
            title: {
              type: 'string',
              minLength: 3,
            },
            description: {
              type: 'string',
              minLength: 5,
            },
            dueAt: {
              type: 'string',
              format: 'date-time',
            },
            maxMarks: {
              type: 'number',
              exclusiveMinimum: 0,
            },
          },
        },

        response: {
          201: {
            description: 'Assignment created successfully',
            type: 'object',
            additionalProperties: true,
          },
          400: {
            description: 'Invalid assignment data',
            type: 'object',
            additionalProperties: true,
          },
          401: {
            description: 'Authentication required',
            type: 'object',
            additionalProperties: true,
          },
          403: {
            description: 'Faculty or admin access required',
            type: 'object',
            additionalProperties: true,
          },
          404: {
            description: 'Course not found',
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = createAssignmentSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid request body',
          },
        });
      }

      const assignment = await service.createAssignment(parsed.data);

      return reply
        .status(201)
        .send(successResponse('Assignment created successfully', assignment));
    },
  );

  // Get assignments for a course: Authenticated users
  app.get(
    '/assignments/course/:courseId',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Assignments'],
        summary: 'Get course assignments',
        description:
          'Returns all assignments belonging to a course. Authenticated users only.',
        security: [{ bearerAuth: [] }],

        params: {
          type: 'object',
          required: ['courseId'],
          properties: {
            courseId: {
              type: 'string',
              format: 'uuid',
            },
          },
        },

        response: {
          200: {
            description: 'Assignments retrieved successfully',
            type: 'object',
            additionalProperties: true,
          },
          401: {
            description: 'Authentication required',
            type: 'object',
            additionalProperties: true,
          },
          404: {
            description: 'Course not found',
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
    async (request, reply) => {
      const { courseId } = request.params as { courseId: string };

      const assignments = await service.getAssignmentsByCourse(courseId);

      return reply.send(
        successResponse('Assignments retrieved successfully', assignments),
      );
    },
  );

  // Get assignment by ID: Authenticated users
  app.get(
    '/assignments/:id',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Assignments'],
        summary: 'Get assignment by ID',
        description:
          'Returns a single assignment using its ID. Authenticated users only.',
        security: [{ bearerAuth: [] }],

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
          200: {
            description: 'Assignment retrieved successfully',
            type: 'object',
            additionalProperties: true,
          },
          401: {
            description: 'Authentication required',
            type: 'object',
            additionalProperties: true,
          },
          404: {
            description: 'Assignment not found',
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const assignment = await service.getAssignmentById(id);

      return reply.send(
        successResponse('Assignment retrieved successfully', assignment),
      );
    },
  );

  // Update assignment: Faculty and Admin only
  app.patch(
    '/assignments/:id',
    {
      preHandler: [authenticate, authorize('faculty', 'admin')],
      schema: {
        tags: ['Assignments'],
        summary: 'Update an assignment',
        description:
          'Updates one or more fields of an existing assignment. Faculty and admin users only.',
        security: [{ bearerAuth: [] }],

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

        body: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              minLength: 3,
            },
            description: {
              type: 'string',
              minLength: 5,
            },
            dueAt: {
              type: 'string',
              format: 'date-time',
            },
            maxMarks: {
              type: 'number',
              exclusiveMinimum: 0,
            },
          },
        },

        response: {
          200: {
            description: 'Assignment updated successfully',
            type: 'object',
            additionalProperties: true,
          },
          400: {
            description: 'Invalid assignment data',
            type: 'object',
            additionalProperties: true,
          },
          401: {
            description: 'Authentication required',
            type: 'object',
            additionalProperties: true,
          },
          403: {
            description: 'Faculty or admin access required',
            type: 'object',
            additionalProperties: true,
          },
          404: {
            description: 'Assignment not found',
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const parsed = updateAssignmentSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid request body',
          },
        });
      }

      const assignment = await service.updateAssignment(id, parsed.data);

      return reply.send(
        successResponse('Assignment updated successfully', assignment),
      );
    },
  );

  // Delete assignment: Admin only
  app.delete(
    '/assignments/:id',
    {
      preHandler: [authenticate, authorize('admin')],
      schema: {
        tags: ['Assignments'],
        summary: 'Delete an assignment',
        description: 'Deletes an assignment. Admin users only.',
        security: [{ bearerAuth: [] }],

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
            description: 'Assignment deleted successfully',
          },
          401: {
            description: 'Authentication required',
            type: 'object',
            additionalProperties: true,
          },
          403: {
            description: 'Admin access required',
            type: 'object',
            additionalProperties: true,
          },
          404: {
            description: 'Assignment not found',
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      await service.deleteAssignment(id);

      return reply.status(204).send();
    },
  );
}