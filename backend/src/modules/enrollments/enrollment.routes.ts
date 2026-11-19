import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { AppError } from '../../errors/app-error.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { successResponse } from '../../utils/response.js';

import { createEnrollmentSchema } from './enrollment.schema.js';

import type { createEnrollmentService } from './enrollment.service.js';

type EnrollmentRoutesOptions = {
  service: ReturnType<typeof createEnrollmentService>;
};

const enrollmentAccess = [authenticate, authorize('faculty', 'admin')];
const uuidSchema = z.string().uuid();
const rejectRequestSchema = z.object({
  reason: z.string().trim().min(5).max(1000),
});

export async function enrollmentRoutes(
  app: FastifyInstance,
  { service }: EnrollmentRoutesOptions,
): Promise<void> {
  app.get(
    '/enrollments/me',
    { preHandler: [authenticate, authorize('student')] },
    async (request) => {
      const user = request.user as { sub: string };
      const enrollments = await service.getCurrentStudentEnrollments(user.sub);
      return successResponse('Your enrollment requests retrieved', enrollments);
    },
  );

  app.post<{ Params: { courseId: string } }>(
    '/courses/:courseId/enrollment-requests',
    { preHandler: [authenticate, authorize('student')] },
    async (request, reply) => {
      const courseId = uuidSchema.safeParse(request.params.courseId);
      if (!courseId.success) {
        throw new AppError('Invalid course ID', 400, 'VALIDATION_ERROR');
      }
      const user = request.user as { sub: string };
      const enrollment = await service.requestEnrollment(
        user.sub,
        courseId.data,
      );
      return reply
        .status(201)
        .send(successResponse('Enrollment request submitted', enrollment));
    },
  );

  app.get(
    '/enrollments/requests',
    { preHandler: enrollmentAccess },
    async (request) => {
      const parsed = z
        .object({
          status: z
            .enum(['pending', 'approved', 'rejected'])
            .default('pending'),
        })
        .safeParse(request.query);
      if (!parsed.success) {
        throw new AppError(
          'Invalid enrollment request status',
          400,
          'VALIDATION_ERROR',
        );
      }
      const user = request.user as { sub: string; role: 'faculty' | 'admin' };
      const requests = await service.listRequests(parsed.data.status, user);
      return successResponse('Enrollment requests retrieved', requests);
    },
  );

  app.post<{ Params: { id: string } }>(
    '/enrollments/:id/approve',
    { preHandler: enrollmentAccess },
    async (request) => {
      const id = uuidSchema.safeParse(request.params.id);
      if (!id.success) {
        throw new AppError('Invalid enrollment ID', 400, 'VALIDATION_ERROR');
      }
      const user = request.user as { sub: string; role: 'faculty' | 'admin' };
      const enrollment = await service.reviewRequest(id.data, 'approved', user);
      return successResponse('Enrollment request approved', enrollment);
    },
  );

  app.post<{ Params: { id: string }; Body: { reason: string } }>(
    '/enrollments/:id/reject',
    { preHandler: enrollmentAccess },
    async (request) => {
      const id = uuidSchema.safeParse(request.params.id);
      const body = rejectRequestSchema.safeParse(request.body);
      if (!id.success || !body.success) {
        throw new AppError(
          'Valid enrollment ID and rejection reason are required',
          400,
          'VALIDATION_ERROR',
        );
      }
      const user = request.user as { sub: string; role: 'faculty' | 'admin' };
      const enrollment = await service.reviewRequest(
        id.data,
        'rejected',
        user,
        body.data.reason,
      );
      return successResponse('Enrollment request rejected', enrollment);
    },
  );

  // Create enrollment. Only faculty and admins can manage enrollment.
  app.post(
    '/enrollments',
    {
      preHandler: enrollmentAccess,
      schema: {
        tags: ['Enrollments'],
        summary: 'Enroll a student',
        description: 'Enrolls a student in a course.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['studentId', 'courseId'],
          properties: {
            studentId: { type: 'string', format: 'uuid' },
            courseId: { type: 'string', format: 'uuid' },
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
          401: {
            description: 'Authentication required',
            type: 'object',
            additionalProperties: true,
          },
          403: {
            description: 'Insufficient permissions',
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

      const user = request.user as { sub: string; role: 'faculty' | 'admin' };
      const enrollment = await service.enrollStudent(
        result.data.studentId,
        result.data.courseId,
        user,
      );

      return reply
        .status(201)
        .send(successResponse('Student enrolled successfully', enrollment));
    },
  );

  // Retrieve enrollments for a student. Only faculty and admins can access.
  app.get<{ Params: { studentId: string } }>(
    '/enrollments/student/:studentId',
    {
      preHandler: enrollmentAccess,
      schema: {
        tags: ['Enrollments'],
        summary: 'Get student enrollments',
        description: 'Returns all course enrollments for a student.',
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
            description: 'Student enrollments retrieved successfully',
            type: 'object',
            additionalProperties: true,
          },
          401: {
            description: 'Authentication required',
            type: 'object',
            additionalProperties: true,
          },
          403: {
            description: 'Insufficient permissions',
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

  // Delete enrollment. Only faculty and admins can manage enrollment.
  app.delete<{ Params: { id: string } }>(
    '/enrollments/:id',
    {
      preHandler: enrollmentAccess,
      schema: {
        tags: ['Enrollments'],
        summary: 'Delete an enrollment',
        description: 'Removes a student enrollment.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          204: {
            description: 'Enrollment deleted successfully',
          },
          401: {
            description: 'Authentication required',
            type: 'object',
            additionalProperties: true,
          },
          403: {
            description: 'Insufficient permissions',
            type: 'object',
            additionalProperties: true,
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
