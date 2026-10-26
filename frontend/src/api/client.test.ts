import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest } from './client';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('apiRequest', () => {
  it('sends bearer credentials and parses the backend success envelope', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, message: 'ok', data: { id: 'course-1' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(apiRequest<{ id: string }>('/courses', { token: 'safe-token' })).resolves.toEqual({ id: 'course-1' });
    const [, options] = fetchMock.mock.calls[0] ?? [];
    expect(new Headers(options?.headers).get('Authorization')).toBe('Bearer safe-token');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/courses');
  });

  it('returns undefined for empty successful responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    await expect(apiRequest<void>('/students/student-1', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('accepts successful message-only responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, message: 'Quiz deleted successfully' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await expect(apiRequest<void>('/quizzes/quiz-1', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('exposes structured backend errors without changing their status or code', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to perform this action' },
      }), { status: 403, headers: { 'Content-Type': 'application/json' } }),
    );

    await expect(apiRequest('/students', { token: 'token' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      code: 'FORBIDDEN',
      message: 'You do not have permission to perform this action',
    });
  });

  it('normalizes network failures into an explicit API error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('private network diagnostic'));
    await expect(apiRequest('/courses')).rejects.toMatchObject({
      name: 'ApiError',
      status: 0,
      code: 'NETWORK_ERROR',
      message: expect.stringContaining('Could not connect'),
    });
  });

  it('rejects unreadable and malformed success envelopes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not json', { status: 200 }));
    await expect(apiRequest('/courses')).rejects.toBeInstanceOf(ApiError);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: false }), { status: 200 }),
    );
    await expect(apiRequest('/courses')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
