import { afterEach, describe, expect, it, vi } from 'vitest';
import { studentsApi } from './students.api';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('studentsApi.linkableUsers', () => {
  it('requests a paginated, searched list of linkable student accounts', async () => {
    const responseData = {
      accounts: [
        { id: 'account-id', name: 'A Student', email: 'a@example.com' },
      ],
      pagination: { page: 2, limit: 10, total: 12, totalPages: 2 },
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: responseData }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      studentsApi.linkableUsers(
        'student-id',
        2,
        '  A Student  ',
        'access-token',
      ),
    ).resolves.toEqual(responseData);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/students/student-id/linkable-users?page=2&limit=10&search=A+Student',
    );
  });

  it('omits an empty search from the request', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            accounts: [],
            pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await studentsApi.linkableUsers('student-id', 1, ' ', 'access-token');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/students/student-id/linkable-users?page=1&limit=10',
      expect.any(Object),
    );
  });
});
