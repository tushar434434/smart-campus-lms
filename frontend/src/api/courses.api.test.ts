import { afterEach, describe, expect, it, vi } from 'vitest';
import { listEnrolledCourses } from './courses.api';
import { enrollmentsApi } from './enrollments.api';
import { coursesApi } from './courses.api';

vi.mock('./enrollments.api', () => ({
  enrollmentsApi: { mine: vi.fn() },
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('listEnrolledCourses', () => {
  it('returns approved enrollments for approved courses only', async () => {
    vi.mocked(enrollmentsApi.mine).mockResolvedValue([
      {
        id: 'enroll-1',
        studentId: 'student-1',
        courseId: 'course-approved',
        status: 'approved',
        rejectionReason: null,
        requestedAt: '2026-01-01T00:00:00.000Z',
        enrolledAt: '2026-01-01T00:00:00.000Z',
        reviewedAt: null,
        reviewedById: null,
      },
      {
        id: 'enroll-2',
        studentId: 'student-1',
        courseId: 'course-pending',
        status: 'pending',
        rejectionReason: null,
        requestedAt: '2026-01-01T00:00:00.000Z',
        enrolledAt: '2026-01-01T00:00:00.000Z',
        reviewedAt: null,
        reviewedById: null,
      },
    ]);
    const get = vi.spyOn(coursesApi, 'get').mockResolvedValue({
      id: 'course-approved',
      title: 'Approved Course',
      code: 'CS101',
      credits: 3,
      ownerFacultyId: 'faculty-1',
      approvalStatus: 'approved',
      rejectionReason: null,
      reviewedAt: null,
      reviewedById: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    await expect(listEnrolledCourses('student-token')).resolves.toEqual([
      expect.objectContaining({ id: 'course-approved', approvalStatus: 'approved' }),
    ]);
    expect(enrollmentsApi.mine).toHaveBeenCalledWith('student-token');
    expect(get).toHaveBeenCalledWith('course-approved', 'student-token');
    expect(get).not.toHaveBeenCalledWith('course-pending', 'student-token');
  });
});
