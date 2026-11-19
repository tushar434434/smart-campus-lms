const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '')
  .trim()
  .replace(/\/+$/, '');

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  token?: string;
  body?: unknown;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { token, body, headers, ...requestOptions } = options;
  const requestHeaders = new Headers(headers);
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isFormData) {
    requestHeaders.set('Content-Type', 'application/json');
  }
  const requestBody: BodyInit | undefined =
    body === undefined
      ? undefined
      : isFormData
        ? (body as FormData)
        : JSON.stringify(body);
  if (token) requestHeaders.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...requestOptions,
      headers: requestHeaders,
      ...(requestBody !== undefined ? { body: requestBody } : {}),
    });
  } catch {
    throw new ApiError(
      'Could not connect to the LMS API. Check the API URL and your connection.',
      0,
      'NETWORK_ERROR',
    );
  }

  if (response.status === 204) {
    if (!response.ok) {
      throw new ApiError('The request could not be completed.', response.status, 'HTTP_ERROR');
    }
    return undefined as T;
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(
      response.ok
        ? 'The API returned an unreadable response.'
        : 'The API request failed.',
      response.status,
      'INVALID_RESPONSE',
    );
  }

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('lms:unauthorized'));
    }
    const errorPayload = isRecord(payload) && isRecord(payload.error) ? payload.error : {};
    const message =
      typeof errorPayload.message === 'string'
        ? errorPayload.message
        : response.status === 401
          ? 'Your session is no longer valid. Please sign in again.'
          : response.status === 403
            ? 'You do not have permission to do that.'
            : 'The request could not be completed.';
    const code =
      typeof errorPayload.code === 'string' ? errorPayload.code : 'HTTP_ERROR';
    throw new ApiError(message, response.status, code);
  }

  if (
    !isRecord(payload) ||
    !('success' in payload) ||
    payload.success !== true
  ) {
    throw new ApiError('The API returned an unexpected response.', response.status, 'INVALID_RESPONSE');
  }

  return 'data' in payload ? (payload.data as T) : (undefined as T);
}

export async function apiDownload(path: string, token: string): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      headers: { Authorization: 'Bearer ' + token },
    });
  } catch {
    throw new ApiError(
      'Could not connect to the LMS API. Check the API URL and your connection.',
      0,
      'NETWORK_ERROR',
    );
  }

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('lms:unauthorized'));
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    const errorPayload =
      isRecord(payload) && isRecord(payload.error) ? payload.error : {};
    const message =
      typeof errorPayload.message === 'string'
        ? errorPayload.message
        : response.status === 401
          ? 'Your session is no longer valid. Please sign in again.'
          : response.status === 403
            ? 'You do not have permission to access this file.'
            : 'The download could not be completed.';
    const code =
      typeof errorPayload.code === 'string' ? errorPayload.code : 'HTTP_ERROR';
    throw new ApiError(message, response.status, code);
  }

  return response.blob();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
