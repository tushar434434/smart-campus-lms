import type { FastifyInstance } from 'fastify';

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
  app.post('/assignments', async (request, reply) => {
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

    const assignment = service.createAssignment(parsed.data);

    return reply
      .status(201)
      .send(successResponse('Assignment created successfully', assignment));
  });

  app.get('/assignments/course/:courseId', async (request, reply) => {
    const { courseId } = request.params as { courseId: string };

    const assignments = service.getCourseAssignments(courseId);

    return reply.send(
      successResponse('Assignments retrieved successfully', assignments),
    );
  });

  app.get('/assignments/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const assignment = service.getAssignmentById(id);

    return reply.send(
      successResponse('Assignment retrieved successfully', assignment),
    );
  });

  app.patch('/assignments/:id', async (request, reply) => {
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

    const assignment = service.updateAssignment(id, parsed.data);

    return reply.send(
      successResponse('Assignment updated successfully', assignment),
    );
  });

  app.delete('/assignments/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    service.deleteAssignment(id);

    return reply.status(204).send();
  });
}
