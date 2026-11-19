# Smart Campus LMS --- Frontend Integration Guide

> This guide explains how to connect a frontend to the Smart Campus LMS
> backend. It covers configuration, API-client design, authentication,
> data contracts, error handling, business rules, testing, and a
> checklist for documenting exact endpoints.
>
> **Important:** The backend's route definitions, validation schemas,
> and tests are authoritative. Do not invent endpoint paths, request
> fields, response shapes, roles, or status codes. Confirm them in the
> current source before implementing a screen.

## 1. Backend overview

Technology Role

---

TypeScript / Node.js Backend language and runtime
Fastify HTTP API framework
PostgreSQL Persistent relational database
Prisma Typed database access and schema/migration tooling
JWT Token-based authentication
bcrypt Password hashing
Zod Runtime request validation where configured
Vitest Automated tests
ESLint / Prettier Static analysis and formatting

The backend project includes academic workflows around students,
courses, assignments, submissions, and quiz attempts. Verify the exact
endpoints and permissions against the current implementation.

## 2. Source of truth for integration

---

Concern Inspect

---

App/plugin registration `src/app.ts`

Server startup and port `src/server.ts`

Route methods and paths Route files under `src/modules/`

Business rules Corresponding service files

Database operations Repository files, including Prisma
repositories

Request/response validation Route schemas and Zod schemas

Database entities and relations Actual Prisma schema/configuration
files

Authentication and roles Auth plugin/hooks, guards, and
route pre-handlers

Error envelope and status codes Shared error handler and route
tests

Expected behavior Tests under `tests/`
-----------------------------------------------------------------------

Find relevant files in PowerShell from the `backend` directory:

```powershell
Get-ChildItem src -Recurse -File |
  Where-Object { $_.Name -match 'route|schema|auth|error' } |
  Select-Object -ExpandProperty FullName
```

Search route registrations:

```powershell
Get-ChildItem src -Recurse -File -Include *.ts |
  Select-String -Pattern 'fastify\.(get|post|put|patch|delete)|\.route\(|url:|method:'
```

Inspect available scripts and public environment variable names:

```powershell
Get-Content package.json
Get-Content .env.example
```

Do not share or commit `.env` or `.env.test` if they contain secrets.

## 3. Environment configuration

For a Vite-based frontend, an example public variable is:

```dotenv
VITE_API_BASE_URL=http://localhost:3000
```

This is only an example. Confirm the real host, port, and any global API
prefix in `src/server.ts`, `src/app.ts`, and runtime logs. Include a
route prefix either in the base URL or in the service path, not both.

```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error('VITE_API_BASE_URL is not configured');
}
```

Variables bundled into browser code are public. Never put database
credentials, JWT signing secrets, or other backend secrets in frontend
environment variables.

Before integration: - Start PostgreSQL and verify the backend database
connection. - Configure backend variables using `.env.example`. - Apply
the database migrations/setup required by the repository. - Start the
backend using the script defined in `package.json`. - Confirm the
listening address and port. - Configure the frontend base URL. - Confirm
CORS permits the frontend origin. - Test one public endpoint and one
authenticated endpoint.

## 4. Authentication and authorization

The project uses JWT-based authentication. Confirm the exact
registration/login paths, request fields, response shape, token expiry,
token claims, and delivery mechanism from the backend source.

Frontend requirements: - Send credentials only over HTTPS outside local
development. - Follow the backend's actual token delivery mechanism. -
If the API returns a bearer token, send `Authorization: Bearer <token>`
on protected requests. - If authentication uses cookies, follow the
backend's cookie, credentials, and CSRF requirements instead. - Handle
expired/invalid authentication and permission failures. - Do not place
JWT signing secrets in frontend code. - Do not log credentials or
tokens. - Do not rely on client-side role checks for security. The
backend must authorize every protected request.

Authentication contract to confirm:

---

Detail Source

---

Registration/login methods and Auth route files
paths

Required credential fields Request schemas and tests

Token response or cookie behavior Handler and response tests

Expiration behavior Auth configuration

Current-user endpoint, if present Auth/user routes

Role names and permissions Role definitions and authorization
tests

Logout/revocation behavior, if Auth implementation
present
-----------------------------------------------------------------------

## 5. Shared API client

Centralize base URL, headers, JSON parsing, and error handling instead
of scattering `fetch` calls throughout UI components. The following is a
starter pattern; adapt it to the actual backend response contract.

```typescript
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error('VITE_API_BASE_URL is not configured');
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  token?: string;
};

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, token, headers, ...requestOptions } = options;

  const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}${path}`, {
    ...requestOptions,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const contentType = response.headers.get('content-type');
  const payload: unknown =
    response.status === 204
      ? undefined
      : contentType?.includes('application/json')
        ? await response.json()
        : await response.text();

  if (!response.ok) {
    const errorPayload =
      typeof payload === 'object' && payload !== null
        ? (payload as Record<string, unknown>)
        : {};

    const nestedError =
      typeof errorPayload.error === 'object' && errorPayload.error !== null
        ? (errorPayload.error as Record<string, unknown>)
        : errorPayload;

    throw new ApiError(
      typeof nestedError.message === 'string'
        ? nestedError.message
        : `Request failed with status ${response.status}`,
      response.status,
      typeof nestedError.code === 'string' ? nestedError.code : undefined,
      nestedError.details,
    );
  }

  return payload as T;
}
```

**Adapt before use:** The backend may use a different error envelope,
nest success data, or use cookies rather than bearer tokens. Change this
helper to match the actual implementation; do not force backend
responses to match an assumed shape.

Keep endpoint wrappers in service modules. Example pattern only:

```typescript
// Replace the placeholder path and DTOs with the verified backend contract.
export function getCourse<T>(courseId: string, token: string): Promise<T> {
  return apiRequest<T>(
    `/REPLACE_WITH_VERIFIED_COURSE_ROUTE/${encodeURIComponent(courseId)}`,
    { method: 'GET', token },
  );
}
```

The placeholder is intentionally not a real endpoint.

## 6. Feature integration map

---

Frontend area Contract to identify UI states

---

Authentication Login/register schemas, Loading, invalid
token behavior credentials, success

Dashboard Supported Loading, empty, data,
profile/course/summary error
endpoints

Students Student routes and List/detail, validation,
linking/access rules forbidden, not found

Courses Course routes and List/detail, mutations
permissions only if supported

Assignments Due dates, max marks, List/detail, validation,
visibility/publication deadline state
rules

Submissions Create/read/update/grade Current status,
rules forbidden, graded,
late/error states

Quizzes Quiz availability and Available/unavailable,
attempt routes loading, errors

Quiz attempts Start, question retrieval, In progress, saved,
answer save, submitted, result
submit/results visibility

Faculty/admin Actual role-specific Forbidden, loading,
permissions empty, success
---------------------------------------------------------------------------

Do not expose protected actions merely by hiding buttons. The backend
must enforce roles, ownership, and state transitions.

## 7. DTOs and data types

Define frontend DTOs from actual route schemas and responses. Do not
assume the database model is the same as the public API contract.

Illustrative types only:

```typescript
export interface CourseSummary {
  id: string;
  title: string;
  code: string;
  credits: number;
}

export interface ApiErrorBody {
  success?: false;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}
```

Verify field names and ID types before use. The project has previously
returned structured errors with fields such as `success: false` and an
`error` object containing `code` and `message`, but confirm whether this
envelope applies to every route.

DTO rules: - Use the exact ID type returned by the API. - Treat nullable
fields as nullable. - Handle ISO date strings and timezone conversion
deliberately. - Separate create/update request DTOs from response
DTOs. - Validate numeric grades and maximum marks in the UI for
feedback, but trust the server as the authority. - Never expose correct
quiz answers before the backend permits it. - Do not assume pagination
or sorting unless routes support it.

## 8. Error handling

Use status codes and stable error codes rather than matching English
messages alone.

Status Typical frontend behavior

---

`400` Show validation or business-rule feedback
`401` Start/restore authentication flow
`403` Explain that the action is not permitted
`404` Show a not-found state
`409` Handle conflict if used by the backend
`422` Handle validation if used by the backend
`429` Show rate-limit feedback if configured
`500–599` Show a generic server error

These are common conventions, not a guarantee of the project's exact
mapping. Verify route tests and the shared error handler.

Do not display stack traces or raw Prisma/database errors to end users.
Disable repeat submissions while a mutation is pending. A network
timeout does not prove the server did not process a mutation; refresh
state before retrying a non-idempotent action.

## 9. Business rules to respect

The server remains authoritative; client-side checks are only for user
experience.

### Assignments and submissions

- Read due dates from the backend and display timezone expectations
  clearly.
- Do not assume local browser time decides whether a submission is
  accepted.
- Reflect the server's actual submission status.
- Respect ownership, grading restrictions, and role permissions.
- Confirm exactly when editing is allowed and what happens at the
  deadline.

### Quiz attempts

- Start attempts through the backend; do not fabricate attempt IDs.
- Render the returned attempt and question data.
- Save answers using the exact request schema.
- Handle unpublished/unavailable quizzes and invalid attempts.
- Do not reveal correct answers before permitted.
- Treat the server's submitted status and score as authoritative.
- Follow the backend's actual behavior for repeated submission.

## 10. CORS, cookies, and networking

- Confirm Fastify CORS configuration allows the frontend origin.
- Do not use `mode: "no-cors"` to bypass CORS; it makes the response
  opaque.
- If using cookies, configure `credentials: "include"` and
  credentialed CORS consistently, and follow the backend's CSRF/cookie
  policy.
- If using bearer tokens, send the expected Authorization header.
- `localhost` refers to the machine running the browser. A separate
  device needs the development computer's reachable address.
- Use HTTPS in deployed environments.

## 11. Integration test checklist

- [ ] Method and path match the route.
- [ ] Headers and authentication match backend requirements.
- [ ] Body fields and types match the schema.
- [ ] Success response is parsed correctly, including `204` if
      applicable.
- [ ] Loading and disabled states work.
- [ ] Validation errors are shown clearly.
- [ ] `401` and `403` are handled separately.
- [ ] Not-found and business-rule errors are handled.
- [ ] UI state refreshes after successful mutations.
- [ ] Role-specific actions match backend permissions.
- [ ] No secrets/tokens are logged or bundled.
- [ ] Success and failure paths are tested.

## 12. Latest reported backend verification

The latest test screenshot shared for this project showed:

Metric Result

---

Test files passed 23 / 23
Tests passed 298 / 298
Skipped tests 0
Duration 54.26 seconds

The reported TypeScript build, ESLint, and Prettier checks also passed.
These are recorded results and should be rerun after code changes.

## 13. Exact endpoint inventory --- complete from source

This inventory must be filled from current route files and tests before
frontend coding. Do not guess the values.

---

Feature Method Exact Auth Roles/ownership Request Success Error
path schema response codes

---

Register Verify in Verify Verify Verify Verify Verify Verify
source in  
source

Login Verify in Verify Verify Verify Verify Verify Verify
source in  
source

Current Verify if Verify Verify Verify Verify Verify Verify
user/profile available

Courses Verify in Verify Verify Verify Verify Verify Verify
source in  
source

Assignments Verify in Verify Verify Verify Verify Verify Verify
source in  
source

Submissions Verify in Verify Verify Verify Verify Verify Verify
source in  
source

Quiz attempts Verify in Verify Verify Verify Verify Verify Verify
source in  
source

Quiz results Verify in Verify Verify Verify Verify Verify Verify
source in  
source
--------------------------------------------------------------------------------------------

For every route, copy the exact method, path, schema, response and
errors from the implementation. This avoids common integration failures
caused by guessed URLs, mismatched fields, and incorrect authentication
assumptions.

## 14. Suggested frontend structure

```text
frontend/
├── src/
│   ├── api/
│   │   ├── client.ts
│   │   ├── auth.api.ts
│   │   ├── courses.api.ts
│   │   ├── assignments.api.ts
│   │   ├── submissions.api.ts
│   │   └── quizzes.api.ts
│   ├── components/
│   ├── features/
│   ├── pages/
│   ├── types/
│   │   └── api.ts
│   ├── App.tsx
│   └── main.tsx
├── .env.example
└── package.json
```

This is a suggested frontend layout, not a claim about the existing
backend tree. Keep API calls in service modules, use shared DTOs, and
separate UI components from business logic.

## 15. Definition of done

A frontend feature is integrated when: 1. It uses the exact backend
route and schema. 2. Authentication and permissions work. 3. Success and
error states are implemented. 4. Database changes are reflected
correctly in the UI. 5. Deadline, grading, ownership, and workflow rules
remain server-enforced. 6. Success and failure scenarios are tested. 7.
No secrets are shipped to the browser. 8. Setup and test instructions
are reproducible.

---

**Handoff note:** This document provides the integration architecture
and implementation checklist, but it does not invent a complete list of
API URLs or schemas. The current route files, validation schemas, and
tests define the exact contract. Update this guide and frontend DTOs
whenever that contract changes.
