import type { FastifyInstance } from 'fastify';

import { successResponse } from '../../utils/response.js';

import {
  createSubmissionSchema,
  updateSubmissionSchema,
  gradeSubmissionSchema,
} from './submission.schema.js';

import type { createSubmissionService } from './submission.service.js';

type SubmissionRoutesOptions = {
  service: ReturnType<typeof createSubmissionService>;
};

export async function submissionRoutes(
  app: FastifyInstance,
  { service }: SubmissionRoutesOptions,
) {
  app.post('/submissions', async (request, reply) => {
    const parsed = createSubmissionSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message:
            parsed.error.issues[0]?.message ?? 'Invalid request body',
        },
      });
    }

    const submission = service.createSubmission(parsed.data);

    return reply.status(201).send(
      successResponse('Assignment submitted successfully', submission),
    );
  });

  app.get('/submissions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const submission = service.getSubmissionById(id);

    return reply.send(
      successResponse('Submission retrieved successfully', submission),
    );
  });

  app.get('/submissions/student/:studentId', async (request, reply) => {
    const { studentId } = request.params as { studentId: string };

    const submissions = service.getStudentSubmissions(studentId);

    return reply.send(
      successResponse('Student submissions retrieved successfully', submissions),
    );
  });

  app.get('/submissions/assignment/:assignmentId', async (request, reply) => {
    const { assignmentId } = request.params as { assignmentId: string };

    const submissions = service.getAssignmentSubmissions(assignmentId);

    return reply.send(
      successResponse('Assignment submissions retrieved successfully', submissions),
    );
  });

  app.patch('/submissions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const parsed = updateSubmissionSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message:
            parsed.error.issues[0]?.message ?? 'Invalid request body',
        },
      });
    }

    const submission = service.updateSubmission(id, parsed.data);

    return reply.send(
      successResponse('Submission updated successfully', submission),
    );
  });

  app.patch('/submissions/:id/grade', async (request, reply) => {
    const { id } = request.params as { id: string };

    const parsed = gradeSubmissionSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message:
            parsed.error.issues[0]?.message ?? 'Invalid request body',
        },
      });
    }

    const submission = service.gradeSubmission(id, parsed.data);

    return reply.send(
      successResponse('Submission graded successfully', submission),
    );
  });
}
