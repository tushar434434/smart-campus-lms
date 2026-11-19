# Smart Campus LMS Project Requirements

## Status Convention

- **Implemented** means the behavior exists in the feature-complete `backend/` and/or active `frontend/` tree and is supported by code or tests reviewed for this document.
- **Partial** means some behavior exists but a stated constraint, production guarantee, or user-facing workflow is incomplete.
- **Planned** means desired acceptance criteria are not currently guaranteed by the application.

The repository also contains an older backend snapshot at the workspace root. Requirements below describe `backend/` and `frontend/`; do not assume root-level backend sources have every listed feature.

## 1. Overview and Objectives

Smart Campus LMS is a role-aware learning platform for course organization, student enrollment, assignment collection and grading, quizzes, and academic activity reporting. Its current implementation uses a React/Vite frontend and a TypeScript/Fastify API backed by PostgreSQL and Prisma.

Objectives:

- Give administrators controlled user and academic-record management.
- Give faculty tools to organize teaching, assignments, assessment, and feedback.
- Give students access to their own academic profile, submissions, and quiz attempts.
- Enforce authorization and data ownership in backend services, not only in the UI.
- Maintain reproducible schema evolution, input validation, and automated behavior tests.

## 2. Functional Requirements and Acceptance Criteria

### Roles and accounts

- **Admin - Implemented:** list/search users, inspect a user, change a role, view role-change audit history, and view dashboard totals. Acceptance: non-admin requests receive 401/403; role changes record actor, target, previous role, new role, and timestamp; routes re-check the actor's current database role.
- **Faculty - Implemented:** manage assigned courses and course learning activities, create student records, link eligible student accounts, manage enrollments, create assignments/quizzes, view class work, grade submissions, and download reports. Acceptance: faculty course ownership is checked for course-scoped mutations and roster/report access.
- **Student - Implemented:** public registration creates a student-role account; a linked account can view its own student record, submit and retrieve its own work, take available enrolled-course quizzes, and view permitted results/activity. Acceptance: client-supplied elevated roles are ignored; attempts to access another student's records are denied.
- **Self-service role changes - Planned:** students cannot select faculty/admin during registration; a defined staff provisioning workflow and identity proofing policy remains a deployment responsibility.

### Authentication, authorization, and security

- **JWT authentication - Implemented:** login issues a bearer JWT with a one-hour expiry; passwords are stored as bcrypt hashes. Acceptance: protected routes reject absent/invalid tokens; current role is reloaded for normal requests so stale role claims do not grant privilege.
- **Role and ownership authorization - Implemented:** route-level role checks are supplemented by service-level ownership/enrollment checks on protected resources. Acceptance: student cannot grade, manage accounts, or access another student's work; faculty cannot manage a course they do not own where ownership applies; admin-only operations reject other roles.
- **Password reset OTP - Implemented:** six-digit cryptographically generated OTP, HMAC digest at rest, configurable 1-30 minute TTL (default 10), one-minute resend cooldown, at most five OTP verification failures, and hashed reset token with expiry. Request/verify/reset endpoints are limited to 5/10/5 requests per minute respectively. Unknown account and email delivery failure do not reveal account existence in the response. Acceptance: expired, consumed, exhausted, or incorrect OTPs cannot reset a password; reset token is single-use; passwords require at least eight characters.
- **Email delivery - Partial:** Nodemailer SMTP transport is supported when all four SMTP values are set. Without SMTP, password-reset email cannot be delivered. Acceptance: SMTP integration should be verified in a non-production test mailbox before enabling account recovery in deployment.
- **Operational security - Partial:** request logs redact authorization and cookies; rate limits and generic error output are present. TLS termination, secrets rotation, production monitoring, backup encryption, and security incident procedures are deployment requirements, not implemented application guarantees.

### Student enrollment number and account management

- **Enrollment number generation - Implemented:** newly created student records receive `<prefix><year>-<six-digit-sequence>` (default example shape `SC2026-000001`), using a year-keyed database sequence inside a transaction, with unique constraint and collision handling. The prefix is configurable, alphanumeric, and 1-10 characters. Acceptance: concurrent creation yields unique identifiers; profile edits do not change the identifier.
- **Account linking - Implemented:** faculty/admin can link an eligible unlinked student-role account to a student record; uniqueness prevents linking one user to multiple records. Acceptance: invalid, already-linked, or non-student accounts are rejected; student self-service cannot link accounts.
- **Account lifecycle - Partial:** admin can change roles and delete student records; account suspension, self-service profile management, bulk import, and unlink/relink workflow are not implemented.

### Courses and enrollment

- **Course catalog - Implemented:** list and detail reads are public; course mutations require faculty/admin and service-level ownership checks apply. Course code is unique and validated in the form `[A-Z]{2,5}[0-9]{3,4}`; credits are 1-6. Acceptance: invalid codes/credits are rejected and duplicate codes return a conflict.
- **Course ownership - Implemented:** faculty-created courses are owned by the creating faculty user; admin can assign/change the owner. Acceptance: faculty sees/manages only permitted teaching records.
- **Enrollment - Implemented:** faculty/admin create, list-by-student, and delete enrollments. `(studentId, courseId)` is unique. Acceptance: duplicate enrollment is rejected and only enrolled students can access course-specific learning activities.

### Assignments, submissions, grading, and feedback

- **Assignment management - Implemented:** faculty/admin create and update assignments; admin deletes. Assignment title/description, deadline, and positive maximum marks are validated. Acceptance: mutations enforce course ownership and invalid deadlines/marks are rejected.
- **Submission - Implemented:** a linked student submits once per assignment, updates content before grading subject to deadline/business rules, and can retrieve only their own work. Content is trimmed and at least ten characters; the `(studentId, assignmentId)` key is unique. Acceptance: unlinked students, another student's record, duplicate submissions, and late submissions are rejected according to service rules.
- **File attachment - Implemented:** one PDF, JPEG, PNG, or WebP file per upload, maximum 10 MiB. Files use generated opaque names and private local filesystem permissions; downloads require authentication and service ownership/teaching access. Acceptance: unsupported MIME types, missing file, excessive size, and unauthorized download are rejected; private downloads use `no-store` and `nosniff` headers.
- **Grading and feedback - Implemented:** faculty/admin can set marks and optional feedback (up to 1,000 characters); marks cannot be negative or exceed the assignment maximum. Acceptance: grade and feedback persist, status becomes graded, and students cannot alter a graded submission.
- **Object storage, malware scanning, and retention automation - Planned:** local disk is not a multi-instance production store; add private object storage, scanning/quarantine, lifecycle/retention policy, and backup/restore coverage before scaling.

### Quizzes, attempts, activity, and reporting

- **Quiz authoring - Implemented:** faculty/admin create and edit quizzes and four-option questions, publish when valid, configure duration, positive maximum marks, maximum attempts, availability dates, and result visibility. Admin can delete quizzes. Acceptance: students do not receive correct answers before release; published availability and enrollment are enforced.
- **Attempts - Implemented:** enrolled students start within quiz availability, answer A/B/C/D questions, submit or time out, and receive a result according to release settings; attempt limit and duration are enforced. Acceptance: duplicate/over-limit attempts and changes after submission are rejected; answer/score persistence is covered by repository/workflow tests.
- **Activity tracking - Implemented:** attempts persist lifecycle status and proctoring-style browser events (tab switch, fullscreen/visibility changes, start/submission/time expiry), including counters and suspicious-activity flag. This is client-reported activity, not tamper-proof proctoring. Acceptance: events are associated with the authenticated student's active attempt and are reportable.
- **Faculty roster and PDF reports - Implemented:** assignment and quiz reports include enrolled students and relevant submission/attempt status and scores. PDF routes require faculty/admin and resource ownership rules apply. Acceptance: students and unrelated faculty cannot download; response is an attachment with `application/pdf`.
- **Advanced analytics, export formats beyond PDF, and tamper-resistant proctoring - Planned.**

### Validation, error handling, and acceptance criteria

- **Implemented:** request schemas use Zod and/or Fastify schemas; UUIDs, emails, enum values, pagination, strings, dates, numeric marks, and upload limits are validated. Successful JSON routes generally use `{ success: true, message?, data? }`; failures use `{ success: false, error: { code, message, details? } }`. File/PDF endpoints return binary content. Validation errors use HTTP 400, unauthenticated 401, forbidden 403, missing resource 404, conflicts 409, size limit 413, rate limit 429, and unexpected errors 500/503 where applicable.
- **Acceptance:** every invalid input is rejected before persistence; errors do not expose password hashes, OTPs, reset tokens, secrets, or stack traces to API clients; tests cover role and ownership boundaries for each sensitive workflow.
- **Partial:** a consistent response envelope exists for most routes, but route implementations include some specialized error shapes; normalize them if clients require a strict universal contract.

## 3. Data and Migration Requirements

- **Implemented:** PostgreSQL schema managed by Prisma migrations. UUID primary keys are used for domain records; unique constraints protect user email, student email/enrollment number/user link, course code, student-course enrollment, student-assignment submission, and attempt-question answer.
- Entities: `User`, `RoleAuditLog`, `PasswordResetToken`, `Student`, `StudentEnrollmentSequence`, `Course`, `Enrollment`, `Assignment`, `Submission`, `Quiz`, `QuizQuestion`, `QuizAttempt`, `QuizAnswer`, and `ProctoringEvent`.
- **Implemented:** foreign keys define deletion behavior; enrollment/submission/quiz attempt children cascade with parent deletion where configured; role audit references restrict deletion; optional course-owner/student-account links use `SET NULL`.
- **Acceptance:** production applies checked-in migrations with `prisma migrate deploy`; do not use `migrate reset` against data-bearing databases; schema edits ship with a reviewed migration and tested rollback/backup plan appropriate to the change.
- **Partial:** migrations exist for initial schema, role audit/password reset, course ownership/enrollment sequence, and submission file metadata. Production backup/restore and migration rollback procedures are operational runbooks still needed.

## 4. Frontend and Backend API Requirements

- **Implemented:** React 19/Vite client calls the Fastify API, stores the authenticated session client-side, sends bearer tokens, handles auth expiry and structured errors, and exposes role-aware learning workflows. Backend is the authority for access checks.
- **Implemented:** API reference is available via Fastify Swagger UI at `/docs`; stable route inventory is in [API.md](API.md).
- **Acceptance:** browser workflows must not expose privileged controls as the only access control; keyboard navigation, visible focus, labels, contrast, screen-reader announcements, and mobile layouts should work.
- **Partial:** responsive layout exists, but accessibility conformance has not been independently audited. Formal WCAG 2.2 AA verification is planned.

## 5. Non-Functional Requirements

- **Security - Partial:** bcrypt password hashing, JWT expiry, role checks, SMTP/OTP protections, rate limiting, private file access, and secret redaction exist. Production additionally requires HTTPS, managed secrets, CORS/origin policy review, SMTP transport verification, security headers review, least-privilege DB credentials, and dependency monitoring.
- **Accessibility - Planned:** test primary flows with keyboard and assistive technology; target WCAG 2.2 AA and document exceptions.
- **Reliability - Partial:** health endpoint checks PostgreSQL, graceful shutdown closes Fastify and Prisma, and integration tests cover PostgreSQL paths. Define SLOs, monitoring/alerts, backup recovery point/objectives, and multi-instance storage before production.
- **Performance - Planned:** no formal latency/throughput objectives or load-test baseline exists. Set measurable targets from expected campus enrollment and run representative load tests before launch.
- **Maintainability - Implemented:** TypeScript, modular services/repositories, Zod, Prisma migrations, ESLint, Prettier, and Vitest scripts are present.
- **Responsive design - Partial:** the React UI is designed for desktop and smaller screens; verify critical workflows at supported viewport sizes and with zoom before release.

## 6. Testing Strategy

- **Implemented:** backend Vitest unit, route, service, repository, security, and PostgreSQL integration tests; frontend Vitest tests with Testing Library; TypeScript build, ESLint, and Prettier scripts.
- **Acceptance:** run backend and frontend tests/build/lint before release; PostgreSQL integration tests must run against a disposable test database, not production. Record skipped tests and test database prerequisites.
- **Planned:** browser-level end-to-end coverage, accessibility automation/manual audit, upload abuse/content validation tests, backup restoration drills, and performance tests.

## 7. Deployment, Limits, and Improvements

- **Implemented for development:** Docker Compose starts PostgreSQL 17; application processes run separately via npm scripts. Private uploads are local disk. SMTP and environment settings are configurable.
- **Production requirements (planned):** deploy backend and frontend behind HTTPS, configure managed PostgreSQL and private persistent/object storage, provision secrets outside source control, run migrations as a controlled release step, configure SMTP, backups/retention, monitoring, and database/network access controls.
- **Known limitations:** local filesystem uploads; client-reported quiz activity is not a secure proctoring system; no account suspension or email verification flag; SMTP is optional at startup; no formal performance/accessibility certification; no production deployment manifests are included.
- **Future improvements:** managed object storage and malware scanning, administrator account lifecycle tools, email verification, accessibility and E2E audits, observability and audit retention policy, analytics, load testing, deployment automation, and explicit data-retention controls.

## 8. Data Retention and Repository Hygiene

- Student submissions, grades, feedback, password-reset metadata, audit history, and quiz activity are sensitive educational records. Define institution-approved retention, deletion, legal hold, and backup expiry periods before production; the application does not currently enforce a complete retention schedule.
- Keep `.env`, credentials, tokens, database dumps, generated secrets, and uploaded student files out of version control. Example files contain placeholders only; local uploads are ignored by Git.
