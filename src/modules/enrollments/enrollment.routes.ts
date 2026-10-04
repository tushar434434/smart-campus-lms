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
  app.post('/enrollments', async (request, reply) => {
    const result = createEnrollmentSchema.safeParse(request.body);

    if (!result.success) {
      throw new AppError(
        result.error.issues.map((issue) => issue.message).join(', '),
        400,
        'VALIDATION_ERROR',
      );
    }

    const enrollment = service.enrollStudent(
      result.data.studentId,
      result.data.courseId,
    );

    return reply
      .status(201)
      .send(successResponse('Student enrolled successfully', enrollment));
  });

  app.get<{ Params: { studentId: string } }>(
    '/enrollments/student/:studentId',
    async (request) => {
      const enrollments = service.getStudentEnrollments(
        request.params.studentId,
      );

      return successResponse(
        'Student enrollments retrieved successfully',
        enrollments,
      );
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/enrollments/:id',
    async (request, reply) => {
      service.deleteEnrollment(request.params.id);

      return reply.status(204).send();
    },
  );
}
