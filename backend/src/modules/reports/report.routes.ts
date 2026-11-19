import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError } from '../../errors/app-error.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import type { createReportService } from './report.service.js';
import { xlsxContentType } from './report.service.js';

type ReportService = ReturnType<typeof createReportService>;
const reportIdSchema = z.string().uuid();

export async function reportRoutes(
  app: FastifyInstance,
  service: ReportService,
): Promise<void> {
  app.get<{ Params: { id: string } }>(
    '/reports/assignments/:id.pdf',
    { preHandler: [authenticate, authorize('faculty', 'admin')] },
    async (request, reply) => {
      const id = reportIdSchema.safeParse(request.params.id);
      if (!id.success) {
        throw new AppError('Invalid assignment ID', 400, 'VALIDATION_ERROR');
      }
      const user = request.user as {
        sub: string;
        role: 'faculty' | 'admin';
      };
      const pdf = await service.assignmentReport(id.data, user);
      return reply
        .type('application/pdf')
        .header(
          'content-disposition',
          `attachment; filename="assignment-report-${id.data}.pdf"`,
        )
        .send(pdf);
    },
  );

  app.get<{ Params: { id: string } }>(
    '/reports/quizzes/:id.pdf',
    { preHandler: [authenticate, authorize('faculty', 'admin')] },
    async (request, reply) => {
      const id = reportIdSchema.safeParse(request.params.id);
      if (!id.success) {
        throw new AppError('Invalid quiz ID', 400, 'VALIDATION_ERROR');
      }
      const user = request.user as {
        sub: string;
        role: 'faculty' | 'admin';
      };
      const pdf = await service.quizReport(id.data, user);
      return reply
        .type('application/pdf')
        .header(
          'content-disposition',
          `attachment; filename="quiz-report-${id.data}.pdf"`,
        )
        .send(pdf);
    },
  );

  app.get<{ Params: { id: string } }>(
    '/reports/assignments/:id.xlsx',
    { preHandler: [authenticate, authorize('faculty', 'admin')] },
    async (request, reply) => {
      const id = reportIdSchema.safeParse(request.params.id);
      if (!id.success) {
        throw new AppError('Invalid assignment ID', 400, 'VALIDATION_ERROR');
      }
      const user = request.user as { sub: string; role: 'faculty' | 'admin' };
      const workbook = await service.assignmentReportXlsx(id.data, user);
      return reply
        .type(xlsxContentType)
        .header(
          'content-disposition',
          `attachment; filename="assignment-report-${id.data}.xlsx"`,
        )
        .send(workbook);
    },
  );

  app.get<{ Params: { id: string } }>(
    '/reports/quizzes/:id.xlsx',
    { preHandler: [authenticate, authorize('faculty', 'admin')] },
    async (request, reply) => {
      const id = reportIdSchema.safeParse(request.params.id);
      if (!id.success) {
        throw new AppError('Invalid quiz ID', 400, 'VALIDATION_ERROR');
      }
      const user = request.user as { sub: string; role: 'faculty' | 'admin' };
      const workbook = await service.quizReportXlsx(id.data, user);
      return reply
        .type(xlsxContentType)
        .header(
          'content-disposition',
          `attachment; filename="quiz-report-${id.data}.xlsx"`,
        )
        .send(workbook);
    },
  );
}
