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
  // Create submission
  app.post(
    '/submissions',
    {
      schema: {
        tags: ['Submissions'],
        summary: 'Create a submission',
        description: 'Creates a new assignment submission.',

        body: {
          type: 'object',
          required: ['studentId', 'assignmentId', 'content'],
          properties: {
            studentId: {
              type: 'string',
              format: 'uuid',
            },
            assignmentId: {
              type: 'string',
              format: 'uuid',
            },
            content: {
              type: 'string',
              minLength: 10,
            },
          },
        },

        response: {
          201: {
            description: 'Assignment submitted successfully',
            type: 'object',
            additionalProperties: true,
          },
          400: {
            description: 'Invalid submission data',
            type: 'object',
            additionalProperties: true,
          },
          404: {
            description: 'Student or assignment not found',
            type: 'object',
            additionalProperties: true,
          },
          409: {
            description: 'Submission already exists',
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
    async (request, reply) => {
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

      return reply
        .status(201)
        .send(
          successResponse(
            'Assignment submitted successfully',
            submission,
          ),
        );
    },
  );

  // Get submission by ID
  app.get(
    '/submissions/:id',
    {
      schema: {
        tags: ['Submissions'],
        summary: 'Get submission by ID',
        description: 'Returns a single submission using its ID.',

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
            description: 'Submission retrieved successfully',
            type: 'object',
            additionalProperties: true,
          },
          404: {
            description: 'Submission not found',
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const submission = service.getSubmissionById(id);

      return reply.send(
        successResponse('Submission retrieved successfully', submission),
      );
    },
  );

  // Get student submissions
  app.get(
    '/submissions/student/:studentId',
    {
      schema: {
        tags: ['Submissions'],
        summary: 'Get student submissions',
        description: 'Returns all submissions made by a student.',

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
            description: 'Student submissions retrieved successfully',
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
      const { studentId } = request.params as { studentId: string };

      const submissions = service.getStudentSubmissions(studentId);

      return reply.send(
        successResponse(
          'Student submissions retrieved successfully',
          submissions,
        ),
      );
    },
  );

  // Get assignment submissions
  app.get(
    '/submissions/assignment/:assignmentId',
    {
      schema: {
        tags: ['Submissions'],
        summary: 'Get assignment submissions',
        description: 'Returns all submissions for an assignment.',

        params: {
          type: 'object',
          required: ['assignmentId'],
          properties: {
            assignmentId: {
              type: 'string',
              format: 'uuid',
            },
          },
        },

        response: {
          200: {
            description: 'Assignment submissions retrieved successfully',
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
      const { assignmentId } = request.params as {
        assignmentId: string;
      };

      const submissions = service.getAssignmentSubmissions(assignmentId);

      return reply.send(
        successResponse(
          'Assignment submissions retrieved successfully',
          submissions,
        ),
      );
    },
  );

  // Update submission
  app.patch(
    '/submissions/:id',
    {
      schema: {
        tags: ['Submissions'],
        summary: 'Update a submission',
        description: 'Updates the content of an existing submission.',

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
          required: ['content'],
          properties: {
            content: {
              type: 'string',
              minLength: 10,
            },
          },
        },

        response: {
          200: {
            description: 'Submission updated successfully',
            type: 'object',
            additionalProperties: true,
          },
          400: {
            description: 'Invalid submission data',
            type: 'object',
            additionalProperties: true,
          },
          404: {
            description: 'Submission not found',
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
    async (request, reply) => {
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
    },
  );

  // Grade submission
  app.patch(
    '/submissions/:id/grade',
    {
      schema: {
        tags: ['Submissions'],
        summary: 'Grade a submission',
        description:
          'Assigns marks and optional feedback to a submission.',

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
          required: ['marks'],
          properties: {
            marks: {
              type: 'number',
              minimum: 0,
            },
            feedback: {
              type: 'string',
              maxLength: 1000,
            },
          },
        },

        response: {
          200: {
            description: 'Submission graded successfully',
            type: 'object',
            additionalProperties: true,
          },
          400: {
            description: 'Invalid grading data',
            type: 'object',
            additionalProperties: true,
          },
          404: {
            description: 'Submission not found',
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
    async (request, reply) => {
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
    },
  );
}