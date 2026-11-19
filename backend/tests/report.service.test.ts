import { describe, expect, it, vi } from 'vitest';
import ExcelJS from 'exceljs';
import { AppError } from '../src/errors/app-error.js';
import { createReportService } from '../src/modules/reports/report.service.js';

describe('Report service', () => {
  const assignment = {
    id: 'assignment-1',
    courseId: 'course-1',
    title: 'Lab report',
    description: 'Practical assignment',
    dueAt: new Date().toISOString(),
    maxMarks: 20,
  };
  it('creates a PDF assignment report after checking the class roster', async () => {
    const service = createReportService(
      { findById: vi.fn().mockResolvedValue(assignment) } as never,
      {} as never,
      {} as never,
      {
        getAssignmentRoster: vi.fn().mockResolvedValue([
          {
            student: {
              id: 'student-1',
              name: 'Student One',
              email: 'student@example.com',
              enrollmentNumber: 'SC2026-000001',
            },
            submission: { status: 'graded', marks: 18 },
            status: 'graded',
          },
        ]),
      } as never,
    );

    const pdf = await service.assignmentReport('assignment-1', {
      sub: 'faculty-1',
      role: 'faculty',
    });

    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('repeats the report table across pages for a long class roster', async () => {
    const roster = Array.from({ length: 40 }, (_, index) => ({
      student: {
        id: `student-${index}`,
        name: `Student ${index}`,
        email: `student-${index}@example.com`,
        enrollmentNumber: `SC2026-${String(index).padStart(6, '0')}`,
      },
      submission: null,
      status: 'not_submitted' as const,
    }));
    const service = createReportService(
      { findById: vi.fn().mockResolvedValue(assignment) } as never,
      {} as never,
      {} as never,
      { getAssignmentRoster: vi.fn().mockResolvedValue(roster) } as never,
    );

    const pdf = await service.assignmentReport('assignment-1', {
      sub: 'faculty-1',
      role: 'faculty',
    });
    const pageObjects =
      pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? [];

    expect(pageObjects.length).toBeGreaterThan(1);
  });

  it('uses the quiz ownership guard before generating a report', async () => {
    const getById = vi
      .fn()
      .mockRejectedValue(new AppError('Access denied', 403, 'FORBIDDEN'));
    const service = createReportService(
      {} as never,
      { getById } as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.quizReport('quiz-1', { sub: 'other-faculty', role: 'faculty' }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
    expect(getById).toHaveBeenCalledWith('quiz-1', {
      sub: 'other-faculty',
      role: 'faculty',
    });
  });

  it('creates an XLSX assignment report from course roster records', async () => {
    const roster = [
      {
        student: {
          id: 'student-1',
          name: 'Student One',
          email: 'student@example.com',
          enrollmentNumber: 'SC2026-000001',
        },
        submission: {
          status: 'graded',
          marks: 18,
          feedback: 'Clear solution',
          submittedAt: new Date('2026-10-30T10:00:00.000Z').toISOString(),
        },
        status: 'graded' as const,
      },
    ];
    const service = createReportService(
      { findById: vi.fn().mockResolvedValue(assignment) } as never,
      {} as never,
      {} as never,
      { getAssignmentRoster: vi.fn().mockResolvedValue(roster) } as never,
      {
        findById: vi.fn().mockResolvedValue({
          id: 'course-1',
          code: 'CS301',
          title: 'Data Structures',
        }),
      } as never,
    );

    const buffer = await service.assignmentReportXlsx('assignment-1', {
      sub: 'faculty-1',
      role: 'faculty',
    });
    expect(buffer.subarray(0, 2).toString()).toBe('PK');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.getWorksheet(1);
    expect(worksheet?.getCell('B2').value).toBe('CS301 - Data Structures');
    expect(worksheet?.getCell('A9').value).toBe('SC2026-000001');
    expect(worksheet?.getCell('F9').value).toBe(18);
    expect(worksheet?.getCell('H9').value).toBe('Clear solution');
  });
});
