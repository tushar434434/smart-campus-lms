import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../src/errors/app-error.js';
import { createSubmissionService } from '../src/modules/submissions/submission.service.js';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findById: vi.fn(),
  findByStudentId: vi.fn(),
  findAllByCourseId: vi.fn(),
  findByAssignmentId: vi.fn(),
  findByStudentAndAssignment: vi.fn(),
  updateContent: vi.fn(),
  grade: vi.fn(),
  findStudentById: vi.fn(),
  findStudentByUserId: vi.fn(),
  findAssignmentById: vi.fn(),
  findCourseById: vi.fn(),
  attachFile: vi.fn(),
  findStoredFile: vi.fn(),
}));

describe('Submission Service', () => {
  let service: ReturnType<typeof createSubmissionService>;

  const studentUser = { sub: 'user-1', role: 'student' as const };
  const facultyUser = { sub: 'faculty-1', role: 'faculty' as const };
  let storedFile: { key: string; mimeType: string; size: number } | undefined;

  const submission = {
    id: 'submission-1',
    studentId: 'student-1',
    assignmentId: 'assignment-1',
    courseId: 'course-1',
    content: 'My assignment',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    storedFile = undefined;

    service = createSubmissionService(
      {
        create: mocks.create,
        findById: mocks.findById,
        findByStudentId: mocks.findByStudentId,
        findByAssignmentId: mocks.findByAssignmentId,
        findByStudentAndAssignment: mocks.findByStudentAndAssignment,
        updateContent: mocks.updateContent,
        grade: mocks.grade,
        attachFile: mocks.attachFile,
        findStoredFile: mocks.findStoredFile,
      } as never,
      {
        findById: mocks.findStudentById,
        findByUserId: mocks.findStudentByUserId,
      } as never,
      {
        findById: mocks.findAssignmentById,
      } as never,
      {
        findAllByCourseId: mocks.findAllByCourseId,
        findByStudentAndCourse: vi
          .fn()
          .mockResolvedValue({ id: 'enrollment-1', status: 'approved' }),
      } as never,
      {
        findById: mocks.findCourseById,
      } as never,
    );
    mocks.findCourseById.mockResolvedValue({
      ownerFacultyId: 'faculty-1',
      approvalStatus: 'approved',
    });
    mocks.findStoredFile.mockImplementation(async () => storedFile);
    mocks.attachFile.mockImplementation(async (_id, file) => {
      storedFile = file;
      return {
        ...submission,
        file: { mimeType: file.mimeType, size: file.size },
      };
    });
  });

  describe('createSubmission', () => {
    const input = {
      studentId: 'student-1',
      assignmentId: 'assignment-1',
      content: 'My assignment',
    };

    it('allows students to submit their own work using the linked student record', async () => {
      mocks.findStudentByUserId.mockResolvedValue({ id: 'student-1' });
      mocks.findStudentById.mockResolvedValue({ id: 'student-1' });
      mocks.findAssignmentById.mockResolvedValue({
        id: 'assignment-1',
        courseId: 'course-1',
        dueAt: new Date(Date.now() + 60_000).toISOString(),
      });
      mocks.findByStudentAndAssignment.mockResolvedValue(undefined);
      mocks.create.mockResolvedValue(submission);

      await expect(
        service.createSubmission(input, studentUser),
      ).resolves.toEqual(submission);

      expect(mocks.findStudentByUserId).toHaveBeenCalledWith('user-1');
      expect(mocks.create).toHaveBeenCalledWith(input);
    });

    it('rejects students submitting for another student', async () => {
      mocks.findStudentByUserId.mockResolvedValue({ id: 'student-1' });

      await expect(
        service.createSubmission(
          { ...input, studentId: 'student-2' },
          studentUser,
        ),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });

      expect(mocks.create).not.toHaveBeenCalled();
    });

    it('rejects student accounts that are not linked to a student record', async () => {
      mocks.findStudentByUserId.mockResolvedValue(undefined);

      await expect(
        service.createSubmission(input, studentUser),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });

      expect(mocks.findStudentById).not.toHaveBeenCalled();
    });

    it('rejects submissions when the student does not exist', async () => {
      mocks.findStudentById.mockResolvedValue(undefined);

      await expect(
        service.createSubmission(input, facultyUser),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'STUDENT_NOT_FOUND',
      });
    });

    it('rejects submissions when the assignment does not exist', async () => {
      mocks.findStudentById.mockResolvedValue({ id: 'student-1' });
      mocks.findAssignmentById.mockResolvedValue(undefined);

      await expect(
        service.createSubmission(input, facultyUser),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'ASSIGNMENT_NOT_FOUND',
      });
    });

    it('rejects submissions after the assignment deadline', async () => {
      mocks.findStudentById.mockResolvedValue({ id: 'student-1' });
      mocks.findAssignmentById.mockResolvedValue({
        id: 'assignment-1',
        dueAt: new Date(Date.now() - 60_000).toISOString(),
      });

      await expect(
        service.createSubmission(input, facultyUser),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'ASSIGNMENT_DEADLINE_PASSED',
      });

      expect(mocks.create).not.toHaveBeenCalled();
    });
    it('rejects duplicate submissions', async () => {
      mocks.findStudentByUserId.mockResolvedValue({ id: 'student-1' });
      mocks.findStudentById.mockResolvedValue({ id: 'student-1' });
      mocks.findAssignmentById.mockResolvedValue({
        id: 'assignment-1',
        dueAt: new Date(Date.now() + 60_000).toISOString(),
      });
      mocks.findByStudentAndAssignment.mockResolvedValue(submission);

      await expect(
        service.createSubmission(input, studentUser),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'SUBMISSION_EXISTS',
      });

      expect(mocks.create).not.toHaveBeenCalled();
    });
  });

  describe('getAssignmentRoster', () => {
    it('includes enrolled students who have not submitted and identifies late work', async () => {
      mocks.findAssignmentById.mockResolvedValue({
        id: 'assignment-1',
        courseId: 'course-1',
        dueAt: new Date(Date.now() - 60_000).toISOString(),
      });
      mocks.findAllByCourseId.mockResolvedValue([
        { studentId: 'student-1', status: 'approved' },
        { studentId: 'student-2', status: 'approved' },
      ]);
      mocks.findByAssignmentId.mockResolvedValue([
        {
          ...submission,
          studentId: 'student-1',
          submittedAt: new Date().toISOString(),
          status: 'submitted',
        },
      ]);
      mocks.findStudentById
        .mockResolvedValueOnce({
          id: 'student-1',
          name: 'Late Learner',
          email: 'late@example.com',
          enrollmentNumber: 'SC2026-000001',
        })
        .mockResolvedValueOnce({
          id: 'student-2',
          name: 'Missing Learner',
          email: 'missing@example.com',
          enrollmentNumber: 'SC2026-000002',
        });

      await expect(
        service.getAssignmentRoster('assignment-1', facultyUser),
      ).resolves.toEqual([
        expect.objectContaining({
          student: expect.objectContaining({ id: 'student-1' }),
          status: 'late',
        }),
        expect.objectContaining({
          student: expect.objectContaining({ id: 'student-2' }),
          submission: null,
          status: 'not_submitted',
        }),
      ]);
    });

    it('denies faculty access to a course assigned to someone else', async () => {
      mocks.findAssignmentById.mockResolvedValue({
        id: 'assignment-1',
        courseId: 'course-1',
      });
      mocks.findCourseById.mockResolvedValue({
        ownerFacultyId: 'another-faculty',
      });

      await expect(
        service.getAssignmentRoster('assignment-1', facultyUser),
      ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
      expect(mocks.findAllByCourseId).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentStudentActivity', () => {
    it('returns the authenticated student submissions with assignment context', async () => {
      mocks.findStudentByUserId.mockResolvedValue({ id: 'student-1' });
      mocks.findByStudentId.mockResolvedValue([submission]);
      mocks.findAssignmentById.mockResolvedValue({
        id: 'assignment-1',
        courseId: 'course-1',
        title: 'Lab report',
        dueAt: '2026-06-01T12:00:00.000Z',
        maxMarks: 20,
      });

      mocks.findCourseById.mockResolvedValue({
        id: 'course-1',
        title: 'Biology',
      });

      await expect(
        service.getCurrentStudentActivity(studentUser),
      ).resolves.toEqual([
        expect.objectContaining({
          assignmentTitle: 'Lab report',
          courseTitle: 'Biology',
          dueAt: '2026-06-01T12:00:00.000Z',
          maxMarks: 20,
        }),
      ]);
    });
  });

  describe('submission file handling', () => {
    it('validates, stores, and returns authorized PDF attachments', async () => {
      mocks.findById.mockResolvedValue(submission);
      mocks.findStudentByUserId.mockResolvedValue({ id: 'student-1' });
      mocks.findAssignmentById.mockResolvedValue({
        dueAt: new Date(Date.now() + 60_000).toISOString(),
      });
      const content = Buffer.from('%PDF-1.7\nexample');

      const uploaded = await service.uploadSubmissionFile(
        'submission-1',
        content,
        'application/pdf',
        studentUser,
      );

      expect(uploaded.file).toEqual({
        mimeType: 'application/pdf',
        size: content.byteLength,
      });
      await expect(
        service.getSubmissionFile('submission-1', studentUser),
      ).resolves.toMatchObject({
        buffer: content,
        mimeType: 'application/pdf',
        size: content.byteLength,
      });
    });

    it('rejects file content that does not match the declared type', async () => {
      mocks.findById.mockResolvedValue(submission);
      mocks.findStudentByUserId.mockResolvedValue({ id: 'student-1' });
      mocks.findAssignmentById.mockResolvedValue({
        dueAt: new Date(Date.now() + 60_000).toISOString(),
      });

      await expect(
        service.uploadSubmissionFile(
          'submission-1',
          Buffer.from('not a pdf'),
          'application/pdf',
          studentUser,
        ),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_FILE_CONTENT',
      });
      expect(mocks.attachFile).not.toHaveBeenCalled();
    });

    it('rejects uploads after the assignment deadline', async () => {
      mocks.findById.mockResolvedValue(submission);
      mocks.findStudentByUserId.mockResolvedValue({ id: 'student-1' });
      mocks.findAssignmentById.mockResolvedValue({
        dueAt: new Date(Date.now() - 60_000).toISOString(),
      });

      await expect(
        service.uploadSubmissionFile(
          'submission-1',
          Buffer.from('%PDF-1.7\nexample'),
          'application/pdf',
          studentUser,
        ),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'ASSIGNMENT_DEADLINE_PASSED',
      });
      expect(mocks.attachFile).not.toHaveBeenCalled();
    });

    it('rejects file replacement after grading', async () => {
      mocks.findById.mockResolvedValue({ ...submission, status: 'graded' });
      mocks.findStudentByUserId.mockResolvedValue({ id: 'student-1' });

      await expect(
        service.uploadSubmissionFile(
          'submission-1',
          Buffer.from('%PDF-1.7\nexample'),
          'application/pdf',
          studentUser,
        ),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'SUBMISSION_ALREADY_GRADED',
      });
      expect(mocks.attachFile).not.toHaveBeenCalled();
    });

    it('does not disclose files to another student', async () => {
      mocks.findById.mockResolvedValue(submission);
      mocks.findStudentByUserId.mockResolvedValue({ id: 'student-2' });

      await expect(
        service.getSubmissionFile('submission-1', studentUser),
      ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
      expect(mocks.findStoredFile).not.toHaveBeenCalled();
    });
  });

  describe('getSubmissionById', () => {
    it('returns a submission owned by the authenticated student', async () => {
      mocks.findById.mockResolvedValue(submission);
      mocks.findStudentByUserId.mockResolvedValue({ id: 'student-1' });

      await expect(
        service.getSubmissionById('submission-1', studentUser),
      ).resolves.toEqual(submission);
    });

    it('rejects students viewing another student’s submission', async () => {
      mocks.findById.mockResolvedValue({
        ...submission,
        studentId: 'student-2',
      });
      mocks.findStudentByUserId.mockResolvedValue({ id: 'student-1' });

      await expect(
        service.getSubmissionById('submission-1', studentUser),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    });

    it('returns 404 when the submission does not exist', async () => {
      mocks.findById.mockResolvedValue(undefined);

      await expect(
        service.getSubmissionById('missing-id', facultyUser),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'SUBMISSION_NOT_FOUND',
      });
    });
  });

  describe('getStudentSubmissions', () => {
    it('rejects students requesting another student’s submissions', async () => {
      mocks.findStudentByUserId.mockResolvedValue({ id: 'student-1' });

      await expect(
        service.getStudentSubmissions('student-2', studentUser),
      ).rejects.toBeInstanceOf(AppError);

      expect(mocks.findStudentById).not.toHaveBeenCalled();
    });

    it('returns submissions for the authenticated student’s record', async () => {
      mocks.findStudentByUserId.mockResolvedValue({ id: 'student-1' });
      mocks.findStudentById.mockResolvedValue({ id: 'student-1' });
      mocks.findByStudentId.mockResolvedValue([submission]);

      await expect(
        service.getStudentSubmissions('student-1', studentUser),
      ).resolves.toEqual([submission]);
    });

    it('allows faculty to view submissions for an existing student', async () => {
      mocks.findStudentById.mockResolvedValue({ id: 'student-1' });
      mocks.findByStudentId.mockResolvedValue([submission]);

      await expect(
        service.getStudentSubmissions('student-1', facultyUser),
      ).resolves.toEqual([submission]);
    });
  });

  describe('getAssignmentSubmissions', () => {
    it('rejects students from viewing all assignment submissions', async () => {
      await expect(
        service.getAssignmentSubmissions('assignment-1', studentUser),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });

      expect(mocks.findAssignmentById).not.toHaveBeenCalled();
    });

    it('returns submissions for an existing assignment', async () => {
      mocks.findAssignmentById.mockResolvedValue({ id: 'assignment-1' });
      mocks.findByAssignmentId.mockResolvedValue([submission]);

      await expect(
        service.getAssignmentSubmissions('assignment-1', facultyUser),
      ).resolves.toEqual([submission]);
    });
  });

  describe('updateSubmission', () => {
    it('rejects edits to graded submissions and preserves the grade', async () => {
      mocks.findById.mockResolvedValue({
        ...submission,
        status: 'graded',
        marks: 8,
        feedback: 'Good work',
      });
      mocks.findStudentByUserId.mockResolvedValue({ id: 'student-1' });

      await expect(
        service.updateSubmission(
          'submission-1',
          { content: 'Changed after grading' },
          studentUser,
        ),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'SUBMISSION_ALREADY_GRADED',
      });

      expect(mocks.updateContent).not.toHaveBeenCalled();
    });

    it('allows students to update their own submission', async () => {
      mocks.findById.mockResolvedValue(submission);
      mocks.findStudentByUserId.mockResolvedValue({ id: 'student-1' });
      mocks.findAssignmentById.mockResolvedValue({
        dueAt: new Date(Date.now() + 60_000).toISOString(),
      });
      mocks.updateContent.mockResolvedValue({
        ...submission,
        content: 'Updated content',
      });

      await expect(
        service.updateSubmission(
          'submission-1',
          { content: 'Updated content' },
          studentUser,
        ),
      ).resolves.toMatchObject({ content: 'Updated content' });
    });

    it('rejects students updating another student’s submission', async () => {
      mocks.findById.mockResolvedValue({
        ...submission,
        studentId: 'student-2',
      });
      mocks.findStudentByUserId.mockResolvedValue({ id: 'student-1' });

      await expect(
        service.updateSubmission(
          'submission-1',
          { content: 'Updated content' },
          studentUser,
        ),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });

      expect(mocks.updateContent).not.toHaveBeenCalled();
    });

    it('returns 404 when the submission does not exist', async () => {
      mocks.findById.mockResolvedValue(undefined);

      await expect(
        service.updateSubmission(
          'missing-id',
          { content: 'Updated content' },
          facultyUser,
        ),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'SUBMISSION_NOT_FOUND',
      });
    });
  });

  describe('gradeSubmission', () => {
    const gradeInput = { marks: 80, feedback: 'Good work' };

    it('allows faculty to grade a submission', async () => {
      mocks.findById.mockResolvedValue(submission);
      mocks.findAssignmentById.mockResolvedValue({
        id: 'assignment-1',
        maxMarks: 100,
      });
      mocks.grade.mockResolvedValue({
        ...submission,
        marks: 80,
        feedback: 'Good work',
      });

      await expect(
        service.gradeSubmission('submission-1', gradeInput, facultyUser),
      ).resolves.toMatchObject({ marks: 80 });

      expect(mocks.grade).toHaveBeenCalledWith('submission-1', 80, 'Good work');
    });

    it('returns a conflict when another request grades the submission first', async () => {
      mocks.findById
        .mockResolvedValueOnce(submission)
        .mockResolvedValueOnce({ ...submission, status: 'graded', marks: 75 });
      mocks.findAssignmentById.mockResolvedValue({
        id: 'assignment-1',
        maxMarks: 100,
      });
      mocks.grade.mockResolvedValue(undefined);

      await expect(
        service.gradeSubmission('submission-1', gradeInput, facultyUser),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'SUBMISSION_ALREADY_GRADED',
      });
    });

    it('rejects grading a submission that is already graded', async () => {
      mocks.findById.mockResolvedValue({
        ...submission,
        status: 'graded',
        marks: 80,
        feedback: 'Good work',
      });

      await expect(
        service.gradeSubmission('submission-1', gradeInput, facultyUser),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'SUBMISSION_ALREADY_GRADED',
      });

      expect(mocks.findAssignmentById).not.toHaveBeenCalled();
      expect(mocks.grade).not.toHaveBeenCalled();
    });
    it('rejects students attempting to grade submissions', async () => {
      await expect(
        service.gradeSubmission('submission-1', gradeInput, studentUser),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });

      expect(mocks.findById).not.toHaveBeenCalled();
    });

    it('rejects marks greater than the assignment maximum', async () => {
      mocks.findById.mockResolvedValue(submission);
      mocks.findAssignmentById.mockResolvedValue({
        id: 'assignment-1',
        maxMarks: 50,
      });

      await expect(
        service.gradeSubmission('submission-1', { marks: 80 }, facultyUser),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_MARKS',
      });

      expect(mocks.grade).not.toHaveBeenCalled();
    });

    it('returns 404 when the submission does not exist', async () => {
      mocks.findById.mockResolvedValue(undefined);

      await expect(
        service.gradeSubmission('missing-id', gradeInput, facultyUser),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'SUBMISSION_NOT_FOUND',
      });
    });
  });
});
