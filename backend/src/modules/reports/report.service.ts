import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { AppError } from '../../errors/app-error.js';
import type { AssignmentRepository } from '../assignments/assignment.repository.interface.js';
import type { QuizService } from '../quizzes/quiz.service.js';
import type { QuizAttemptService } from '../quiz-attempts/quiz-attempt.service.js';
import type { createSubmissionService } from '../submissions/submission.service.js';
import type { CourseRepository } from '../courses/course.repository.interface.js';

type ReportUser = {
  sub: string;
  role: 'student' | 'faculty' | 'admin';
};

type ReportColumn = {
  label: string;
  width: number;
};

const MAX_REPORT_ROWS = 50_000;
const xlsxContentType =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function createXlsxReport(
  title: string,
  metadata: Array<[string, string | number]>,
  headers: string[],
  rows: Array<Array<string | number>>,
): Promise<Buffer> {
  if (rows.length > MAX_REPORT_ROWS) {
    throw new AppError(
      `Report exceeds the ${MAX_REPORT_ROWS.toLocaleString()} row export limit`,
      413,
      'REPORT_TOO_LARGE',
    );
  }
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Smart Campus LMS';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet('Report');
  worksheet.addRow(['Smart Campus LMS', title]);
  for (const [label, value] of metadata) worksheet.addRow([label, value]);
  worksheet.addRow([]);
  const header = worksheet.addRow(headers);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF245B91' },
  };
  for (const row of rows) worksheet.addRow(row);
  worksheet.views = [{ state: 'frozen', ySplit: header.number }];
  worksheet.autoFilter = {
    from: { row: header.number, column: 1 },
    to: { row: header.number, column: headers.length },
  };
  worksheet.columns = headers.map((headerText) => ({
    width: Math.min(34, Math.max(14, headerText.length + 4)),
  }));
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function createPdfReport(
  title: string,
  metadata: string[],
  summary: string,
  columns: ReportColumn[],
  rows: string[][],
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 40,
      bufferPages: true,
    });
    const chunks: Buffer[] = [];
    const generatedAt = new Date().toLocaleString();
    const pageBottom = () => document.page.height - 42;
    let y = 40;

    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    document.once('error', reject);
    document.once('end', () => resolve(Buffer.concat(chunks)));

    function drawHeading(continued = false) {
      document
        .font('Helvetica-Bold')
        .fontSize(continued ? 13 : 18)
        .fillColor('#202b3c')
        .text(continued ? `${title} (continued)` : title, 40, y, {
          width: document.page.width - 80,
        });
      y = document.y + 5;
      document
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#687386')
        .text(`Smart Campus LMS | Generated ${generatedAt}`, 40, y);
      y = document.y + 5;

      if (!continued) {
        for (const line of metadata) {
          document.fontSize(9).fillColor('#39465a').text(line, 40, y);
          y = document.y + 3;
        }
        document
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#39465a')
          .text(summary, 40, y, { width: document.page.width - 80 });
        y = document.y + 9;
      } else {
        y += 4;
      }

      drawTableHeader();
    }

    function drawTableHeader() {
      const height = 24;
      let x = 40;
      document.save();
      document.rect(40, y, document.page.width - 80, height).fill('#edf1f6');
      document.restore();
      for (const column of columns) {
        document
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor('#273449')
          .text(column.label, x + 5, y + 7, {
            width: column.width - 10,
            height: height - 8,
          });
        x += column.width;
      }
      y += height;
    }

    drawHeading();
    document.font('Helvetica').fontSize(8);

    for (const row of rows) {
      const heights = row.map((value, index) => {
        const column = columns[index];
        if (!column) {
          throw new Error('Report row does not match its column definition');
        }
        return document.heightOfString(value || '—', {
          width: column.width - 10,
        });
      });
      const rowHeight = Math.max(22, ...heights.map((height) => height + 10));

      if (y + rowHeight > pageBottom()) {
        document.addPage();
        y = 40;
        drawHeading(true);
      }

      let x = 40;
      row.forEach((value, index) => {
        const column = columns[index];
        if (!column) {
          throw new Error('Report row does not match its column definition');
        }
        document
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#303b4c')
          .text(value || '—', x + 5, y + 5, {
            width: column.width - 10,
            height: rowHeight - 8,
          });
        x += column.width;
      });
      y += rowHeight;
      document
        .moveTo(40, y)
        .lineTo(document.page.width - 40, y)
        .lineWidth(0.5)
        .strokeColor('#dce2e9')
        .stroke();
    }

    if (rows.length === 0) {
      document
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#687386')
        .text('No enrolled students were found for this report.', 45, y + 8);
    }

    const pageRange = document.bufferedPageRange();
    for (let pageIndex = 0; pageIndex < pageRange.count; pageIndex += 1) {
      document.switchToPage(pageRange.start + pageIndex);
      document
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#687386')
        .text(
          `Page ${pageIndex + 1} of ${pageRange.count}`,
          40,
          document.page.height - 28,
          { width: document.page.width - 80, align: 'right' },
        );
    }

    document.end();
  });
}

function assignmentCounts(
  roster: Awaited<
    ReturnType<
      ReturnType<typeof createSubmissionService>['getAssignmentRoster']
    >
  >,
  dueAt: string,
) {
  const counts = {
    enrolled: roster.length,
    notSubmitted: 0,
    submitted: 0,
    late: 0,
    graded: 0,
  };
  for (const row of roster) {
    if (!row.submission) {
      counts.notSubmitted += 1;
    } else if (row.submission.status === 'graded') {
      counts.graded += 1;
    } else if (new Date(row.submission.submittedAt) > new Date(dueAt)) {
      counts.late += 1;
    } else {
      counts.submitted += 1;
    }
  }
  return counts;
}

export function createReportService(
  assignmentRepository: AssignmentRepository,
  quizService: QuizService,
  quizAttemptService: QuizAttemptService,
  submissionService: ReturnType<typeof createSubmissionService>,
  courseRepository?: CourseRepository,
) {
  return {
    async assignmentReport(id: string, user: ReportUser): Promise<Buffer> {
      if (user.role === 'student') {
        throw new AppError('Access denied', 403, 'FORBIDDEN');
      }
      const assignment = await assignmentRepository.findById(id);
      if (!assignment) {
        throw new AppError('Assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
      }
      const course = await courseRepository?.findById(assignment.courseId);
      const roster = await submissionService.getAssignmentRoster(id, user);
      if (roster.length > MAX_REPORT_ROWS) {
        throw new AppError(
          'Report exceeds the export row limit',
          413,
          'REPORT_TOO_LARGE',
        );
      }
      const counts = assignmentCounts(roster, assignment.dueAt);
      const summary =
        `Enrolled ${counts.enrolled} | Not submitted ${counts.notSubmitted} | ` +
        `Submitted ${counts.submitted} | Late ${counts.late} | Graded ${counts.graded}`;

      return createPdfReport(
        `Assignment report: ${assignment.title}`,
        [
          `Course: ${course ? `${course.code} · ${course.title}` : assignment.courseId}`,
          `Due: ${new Date(assignment.dueAt).toLocaleString()}`,
          `Maximum marks: ${assignment.maxMarks}`,
        ],
        summary,
        [
          { label: 'Enrollment', width: 90 },
          { label: 'Student', width: 120 },
          { label: 'Email', width: 190 },
          { label: 'Status', width: 90 },
          { label: 'Score', width: 80 },
          { label: 'Submitted', width: 180 },
        ],
        roster.map((row) => [
          row.student.enrollmentNumber,
          row.student.name,
          row.student.email,
          row.submission &&
          row.submission.status !== 'graded' &&
          new Date(row.submission.submittedAt) > new Date(assignment.dueAt)
            ? 'Late'
            : row.status.replace('_', ' '),
          row.submission?.marks === undefined
            ? 'Not graded'
            : `${row.submission.marks}/${assignment.maxMarks}`,
          row.submission
            ? new Date(row.submission.submittedAt).toLocaleString()
            : '—',
        ]),
      );
    },

    async assignmentReportXlsx(id: string, user: ReportUser): Promise<Buffer> {
      if (user.role === 'student') {
        throw new AppError('Access denied', 403, 'FORBIDDEN');
      }
      const assignment = await assignmentRepository.findById(id);
      if (!assignment) {
        throw new AppError('Assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
      }
      const [course, roster] = await Promise.all([
        courseRepository?.findById(assignment.courseId),
        submissionService.getAssignmentRoster(id, user),
      ]);
      return createXlsxReport(
        `Assignment report: ${assignment.title}`,
        [
          [
            'Course',
            course ? `${course.code} - ${course.title}` : assignment.courseId,
          ],
          ['Assignment', assignment.title],
          ['Due', new Date(assignment.dueAt).toISOString()],
          ['Maximum marks', assignment.maxMarks],
          ['Generated', new Date().toISOString()],
        ],
        [
          'Enrollment number',
          'Student',
          'Email',
          'Submission status',
          'Submitted at',
          'Grade',
          'Maximum marks',
          'Feedback',
        ],
        roster.map((row) => [
          row.student.enrollmentNumber,
          row.student.name,
          row.student.email,
          row.status.replace('_', ' '),
          row.submission?.submittedAt ?? 'Not submitted',
          row.submission?.marks ?? 'Not graded',
          assignment.maxMarks,
          row.submission?.feedback ?? '',
        ]),
      );
    },

    async quizReport(id: string, user: ReportUser): Promise<Buffer> {
      if (user.role === 'student') {
        throw new AppError('Access denied', 403, 'FORBIDDEN');
      }
      const quiz = await quizService.getById(id, user);
      const roster = await quizAttemptService.getQuizRoster(id, user);
      const course = await courseRepository?.findById(quiz.courseId);
      if (roster.length > MAX_REPORT_ROWS) {
        throw new AppError(
          'Report exceeds the export row limit',
          413,
          'REPORT_TOO_LARGE',
        );
      }
      const counts = new Map<string, number>();
      for (const row of roster) {
        counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
      }
      const summary = [
        `Enrolled ${roster.length}`,
        ...[...counts.entries()].map(
          ([status, count]) => `${status.replace('_', ' ')} ${count}`,
        ),
      ].join(' | ');

      return createPdfReport(
        `Quiz report: ${quiz.title}`,
        [
          `Course: ${course ? `${course.code} · ${course.title}` : quiz.courseId}`,
          `Status: ${quiz.status}`,
          `Maximum marks: ${quiz.maxMarks}`,
          `Maximum attempts: ${quiz.maxAttempts}`,
        ],
        summary,
        [
          { label: 'Enrollment', width: 90 },
          { label: 'Student', width: 120 },
          { label: 'Email', width: 190 },
          { label: 'Status', width: 105 },
          { label: 'Attempts', width: 75 },
          { label: 'Remaining', width: 75 },
          { label: 'Latest score', width: 95 },
        ],
        roster.map((row) => [
          row.student.enrollmentNumber,
          row.student.name,
          row.student.email,
          row.status.replace('_', ' '),
          String(row.attemptCount),
          String(row.remainingAttempts),
          row.latestAttempt?.score === null ||
          row.latestAttempt?.score === undefined
            ? 'Not scored'
            : `${row.latestAttempt.score}/${quiz.maxMarks}`,
        ]),
      );
    },

    async quizReportXlsx(id: string, user: ReportUser): Promise<Buffer> {
      if (user.role === 'student') {
        throw new AppError('Access denied', 403, 'FORBIDDEN');
      }
      const quiz = await quizService.getById(id, user);
      const [course, roster] = await Promise.all([
        courseRepository?.findById(quiz.courseId),
        quizAttemptService.getQuizRoster(id, user),
      ]);
      return createXlsxReport(
        `Quiz report: ${quiz.title}`,
        [
          [
            'Course',
            course ? `${course.code} - ${course.title}` : quiz.courseId,
          ],
          ['Quiz', quiz.title],
          ['Maximum marks', quiz.maxMarks],
          ['Maximum attempts', quiz.maxAttempts],
          ['Generated', new Date().toISOString()],
        ],
        [
          'Enrollment number',
          'Student',
          'Email',
          'Attempt status',
          'Attempts',
          'Started at',
          'Submitted at',
          'Duration (seconds)',
          'Score',
          'Maximum marks',
        ],
        roster.map((row) => {
          const latest = row.latestAttempt;
          const duration = latest?.submittedAt
            ? Math.max(
                0,
                Math.round(
                  (new Date(latest.submittedAt).getTime() -
                    new Date(latest.startedAt).getTime()) /
                    1000,
                ),
              )
            : '';
          return [
            row.student.enrollmentNumber,
            row.student.name,
            row.student.email,
            row.status.replace('_', ' '),
            row.attemptCount,
            latest?.startedAt.toISOString() ?? '',
            latest?.submittedAt?.toISOString() ?? '',
            duration,
            latest?.score ?? 'Not scored',
            quiz.maxMarks,
          ];
        }),
      );
    },
  };
}

export { xlsxContentType };
