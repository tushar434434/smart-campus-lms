import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { successResponse } from '../../utils/response.js';

import {
  createSubmissionSchema,
  updateSubmissionSchema,
  gradeSubmissionSchema,
} from './submission.schema.js';

import type { createSubmissionService } from './submission.service.js';
import { AppError } from '../../errors/app-error.js';

type SubmissionRoutesOptions = {
  service: ReturnType<typeof createSubmissionService>;
};

function fileExtension(mimeType: string): string {
  switch (mimeType) {
    case 'application/pdf':
      return 'pdf';
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      throw new AppError(
        'Unsupported stored file type',
        500,
        'INVALID_FILE_TYPE',
      );
  }
}

export async function submissionRoutes(
  app: FastifyInstance,
  { service }: SubmissionRoutesOptions,
) {
  app.post(
    '/submissions/file',
    { preHandler: [authenticate, authorize('student')] },
    async (request, reply) => {
      const user = request.user as { sub: string; role: 'student' };
      let file: { buffer: Buffer; mimeType: string } | undefined;
      let content: string | undefined;

      try {
        for await (const part of request.parts()) {
          if (part.type === 'file') {
            if (file) {
              throw new AppError(
                'Only one submission file is allowed',
                400,
                'TOO_MANY_FILES',
              );
            }
            file = { buffer: await part.toBuffer(), mimeType: part.mimetype };
          } else if (part.fieldname === 'content') {
            content = String(part.value);
          } else {
            throw new AppError(
              'Only optional content and one file are accepted',
              400,
              'INVALID_MULTIPART_FIELD',
            );
          }
        }
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(
          'Submission files cannot exceed 10 MiB',
          413,
          'FILE_TOO_LARGE',
        );
      }

      if (!file) {
        throw new AppError(
          'A submission file is required for this endpoint',
          400,
          'FILE_REQUIRED',
        );
      }
      const assignmentId = z
        .string()
        .uuid()
        .safeParse((request.query as { assignmentId?: string }).assignmentId);
      if (!assignmentId.success) {
        throw new AppError(
          'A valid assignmentId query parameter is required',
          400,
          'VALIDATION_ERROR',
        );
      }

      const submission = await service.createSubmissionWithOptionalFile(
        {
          assignmentId: assignmentId.data,
          ...(content !== undefined && { content }),
        },
        file,
        user,
      );
      return reply
        .status(201)
        .send(successResponse('Assignment submission created', submission));
    },
  );

  app.put(
    '/submissions/:id/file',
    { preHandler: [authenticate, authorize('student')] },
    async (request, reply) => {
      const user = request.user as {
        sub: string;
        role: 'student' | 'faculty' | 'admin';
      };
      const part = await request.file();
      if (!part) {
        throw new AppError(
          'A submission file is required',
          400,
          'FILE_REQUIRED',
        );
      }

      let buffer: Buffer;
      try {
        buffer = await part.toBuffer();
      } catch {
        throw new AppError(
          'Submission files cannot exceed 10 MiB',
          413,
          'FILE_TOO_LARGE',
        );
      }

      const submission = await service.uploadSubmissionFile(
        (request.params as { id: string }).id,
        buffer,
        part.mimetype,
        user,
      );
      return reply.send(
        successResponse('Submission file uploaded successfully', submission),
      );
    },
  );

  app.get<{ Params: { id: string }; Querystring: { download?: string } }>(
    '/submissions/:id/file',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user as {
        sub: string;
        role: 'student' | 'faculty' | 'admin';
      };
      const file = await service.getSubmissionFile(request.params.id, user);
      const disposition =
        request.query.download === 'true' ? 'attachment' : 'inline';
      return reply
        .type(file.mimeType)
        .header('cache-control', 'private, no-store')
        .header('x-content-type-options', 'nosniff')
        .header(
          'content-disposition',
          `${disposition}; filename="submission-${request.params.id}.${fileExtension(file.mimeType)}"`,
        )
        .send(file.buffer);
    },
  );

  app.get(
    '/submissions/me',
    { preHandler: [authenticate, authorize('student')] },
    async (request, reply) => {
      const user = request.user as {
        sub: string;
        role: 'student' | 'faculty' | 'admin';
      };
      const activity = await service.getCurrentStudentActivity(user);
      return reply.send(
        successResponse(
          'Student assignment activity retrieved successfully',
          activity,
        ),
      );
    },
  );

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

      const submissions = await service.getStudentSubmissions(studentId, user);

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
    '/submissions/assignment/:assignmentId/roster',
    {
      preHandler: [authenticate, authorize('faculty', 'admin')],
      schema: {
        tags: ['Submissions'],
        summary: 'Get assignment roster and submission status',
        description:
          'Returns every enrolled student for an assignment, including students who have not submitted.',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { assignmentId } = request.params as { assignmentId: string };
      const user = request.user as {
        sub: string;
        role: 'student' | 'faculty' | 'admin';
      };
      const roster = await service.getAssignmentRoster(assignmentId, user);
      return reply.send(
        successResponse('Assignment roster retrieved successfully', roster),
      );
    },
  );

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

      const submission = await service.updateSubmission(id, parsed.data, user);

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

      const submission = await service.gradeSubmission(id, parsed.data, user);

      return reply.send(
        successResponse('Submission graded successfully', submission),
      );
    },
  );
}
