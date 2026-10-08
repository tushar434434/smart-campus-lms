import type { FastifyInstance } from 'fastify';

import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
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
  // Create submission: Student only
  app.post(
    '/submissions',
    {
      preHandler: [authenticate, authorize('student')],
      schema: {
        tags: ['Submissions'],
        summary: 'Create a submission',
        description: 'Creates a new assignment submission. Students only.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['studentId', 'assignmentId', 'content'],
          properties: {
            studentId: { type: 'string', format: 'uuid' },
            assignmentId: { type: 'string', format: 'uuid' },
            content: { type: 'string', minLength: 10 },
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
          401: {
            description: 'Authentication required',
            type: 'object',
            additionalProperties: true,
          },
          403: {
            description: 'Student access required',
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
            message: parsed.error.issues[0]?.message ?? 'Invalid request body',
          },
        });
      }

      const user = request.user as { sub: string; role: 'student' };

      const submission = await service.createSubmission(parsed.data, user);

      return reply
        .status(201)
        .send(successResponse('Assignment submitted successfully', submission));
    },
  );

  // Get submission by ID: Authenticated users
  app.get(
    '/submissions/:id',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Submissions'],
        summary: 'Get submission by ID',
        description:
          'Returns a submission. Students can only view their own submissions.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            description: 'Submission retrieved successfully',
            type: 'object',
            additionalProperties: true,
          },
          401: {
            description: 'Authentication required',
            type: 'object',
            additionalProperties: true,
          },
          403: {
            description: 'Access denied',
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
      const user = request.user as {
        sub: string;
        role: 'student' | 'faculty' | 'admin';
      };

      const submission = await service.getSubmissionById(id, user);

      return reply.send(
        successResponse('Submission retrieved successfully', submission),
      );
    },
  );

  // Get student submissions: Authenticated users
  app.get(
    '/submissions/student/:studentId',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Submissions'],
        summary: 'Get student submissions',
        description:
          'Returns student submissions. Students can only view their own submissions.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['studentId'],
          properties: {
            studentId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            description: 'Student submissions retrieved successfully',
            type: 'object',
            additionalProperties: true,
          },
          401: {
            description: 'Authentication required',
            type: 'object',
            additionalProperties: true,
          },
          403: {
            description: 'Access denied',
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
      const user = request.user as {
        sub: string;
        role: 'student' | 'faculty' | 'admin';
      };

      const submissions = await service.getStudentSubmissions(
        studentId,
        user,
      );

      return reply.send(
        successResponse(
          'Student submissions retrieved successfully',
          submissions,
        ),
      );
    },
  );

  // Get assignment submissions: Faculty and Admin
  app.get(
    '/submissions/assignment/:assignmentId',
    {
      preHandler: [authenticate, authorize('faculty', 'admin')],
      schema: {
        tags: ['Submissions'],
        summary: 'Get assignment submissions',
        description:
          'Returns all submissions for an assignment. Faculty and admin only.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['assignmentId'],
          properties: {
            assignmentId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            description: 'Assignment submissions retrieved successfully',
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
      const { assignmentId } = request.params as {
        assignmentId: string;
      };

      const user = request.user as {
        sub: string;
        role: 'student' | 'faculty' | 'admin';
      };

      const submissions = await service.getAssignmentSubmissions(
        assignmentId,
        user,
      );

      return reply.send(
        successResponse(
          'Assignment submissions retrieved successfully',
          submissions,
        ),
      );
    },
  );

  // Update submission: Student only, own submission
  app.patch(
    '/submissions/:id',
    {
      preHandler: [authenticate, authorize('student')],
      schema: {
        tags: ['Submissions'],
        summary: 'Update a submission',
        description:
          'Updates the content of the authenticated student own submission.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['content'],
          properties: {
            content: { type: 'string', minLength: 10 },
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
          401: {
            description: 'Authentication required',
            type: 'object',
            additionalProperties: true,
          },
          403: {
            description: 'Access denied',
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
            message: parsed.error.issues[0]?.message ?? 'Invalid request body',
          },
        });
      }

      const user = request.user as { sub: string; role: 'student' };

      const submission = await service.updateSubmission(
        id,
        parsed.data,
        user,
      );

      return reply.send(
        successResponse('Submission updated successfully', submission),
      );
    },
  );

  // Grade submission: Faculty and Admin
  app.patch(
    '/submissions/:id/grade',
    {
      preHandler: [authenticate, authorize('faculty', 'admin')],
      schema: {
        tags: ['Submissions'],
        summary: 'Grade a submission',
        description:
          'Assigns marks and optional feedback to a submission. Faculty and admin only.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
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
            message: parsed.error.issues[0]?.message ?? 'Invalid request body',
          },
        });
      }

      const user = request.user as {
        sub: string;
        role: 'student' | 'faculty' | 'admin';
      };

      const submission = await service.gradeSubmission(
        id,
        parsed.data,
        user,
      );

      return reply.send(
        successResponse('Submission graded successfully', submission),
      );
    },
  );
}