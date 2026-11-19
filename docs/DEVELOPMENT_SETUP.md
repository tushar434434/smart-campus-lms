# Development Setup

## Supported Layout and Prerequisites

This guide uses the feature-complete backend in `backend/` and the active React application in `frontend/`. The workspace also contains an older backend snapshot at the root and a mirrored frontend under `backend/frontend`; do not mix their scripts or assume the root snapshot includes OTP, file-upload, PDF-report, or admin-audit features.

Verified local toolchain: Node.js 24.13.0 and npm 11.6.2. The checked-in dependency set includes Vitest 5, whose engine range requires Node 22.12+ or Node 24+ (also compatible with Node 26+); Prisma 7 additionally requires Node 20.19+, 22.12+, or 24+. Use Node 22.12+ (22.x) or Node 24.x for the supported/tested intersection. Install npm with Node or use a compatible npm release.

PostgreSQL 17 is the version selected by `compose.yaml` and is the verified development baseline; compatibility with other PostgreSQL versions has not been established for this project. Docker Engine with Docker Compose is required only if using the included PostgreSQL container. A locally installed PostgreSQL 17 server is an alternative.

## Repository Structure

```text
backend/       Fastify API, Prisma schema/migrations, scripts, tests
frontend/      React/Vite application and frontend tests
prisma/        Older root-level backend schema/migration snapshot
src/           Older root-level backend source snapshot
docs/          Requirements, API, architecture, and setup guides
compose.yaml   Root development PostgreSQL service
```

## Install Dependencies

Run in PowerShell from the workspace root:

```powershell
Set-Location backend
npm ci
Set-Location ..\frontend
npm ci
Set-Location ..
```

Each package has its own `package-lock.json`; `npm ci` uses the lockfile without changing dependency versions. No Python service or Python utility is present, so this project does not use a `requirements.txt`.

Dependency support verified from the current `backend/package.json` and lockfile includes Nodemailer for SMTP OTP email, PDFKit for PDF exports, `@fastify/multipart` for file uploads, Zod for validation, and Vitest for tests. The frontend and backend keep dependencies separate. Do not copy versions between root/backend/frontend manifests; the root manifest is an older snapshot.

## Environment Configuration

Copy the examples and edit local `.env` files; never commit them:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

Backend required settings:

- `DATABASE_URL`: PostgreSQL URL (`postgresql://...` or `postgres://...`); required and validated at startup.
- `JWT_SECRET`: required outside `NODE_ENV=test`. Generate a long random value locally; do not reuse the OTP secret.
- `PASSWORD_RESET_SECRET`: optional; when omitted, OTP signing uses `JWT_SECRET`. Set a separate random value in deployments.
- `PORT`, `HOST`, `NODE_ENV`, and `LOG_LEVEL`: validated with defaults of 3000, `0.0.0.0`, `development`, and `info`.
- `PASSWORD_RESET_OTP_TTL_MINUTES`: defaults to 10 and accepts 1-30.
- `STUDENT_ENROLLMENT_PREFIX`: defaults to `SC`; use 1-10 alphanumeric characters.
- `SUBMISSION_UPLOAD_DIR`: defaults to `var/private-uploads`, relative to the backend process working directory.
- SMTP requires all of `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` together; `SMTP_PORT` defaults to 587. Leave all four blank for development without email delivery. OTP request/verify/reset limits are fixed in code at 5/10/5 per minute; resend cooldown is one minute and OTP failures are capped at five.

The frontend `VITE_API_BASE_URL` is optional and defaults to same-origin requests. `API_PROXY_TARGET` defaults to `http://localhost:3000` for Vite's development proxy. Set it if the backend listens elsewhere. Vite exposes `VITE_` variables to browser code; never put secrets in frontend variables.

The example JWT and SMTP values are placeholders. Generate local secrets with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Run the command separately for JWT and password-reset secrets, then place the outputs in the ignored backend `.env` file.

## Start PostgreSQL and Migrate

From the workspace root:

```powershell
docker compose up -d postgres
docker compose ps
```

Use a local-only development database credential and ensure `DATABASE_URL` in `backend/.env` matches the PostgreSQL credentials configured in `compose.yaml`. Never reuse a development credential in production.

Apply migrations safely from `backend/`:

```powershell
Set-Location backend
npx prisma migrate deploy
npx prisma generate
```

`migrate deploy` applies checked-in pending migrations without resetting data. Never run `prisma migrate reset` against a database containing data you need. Back up production data and review migration SQL before release.

## Provision the Initial Admin

Public registration always creates a student account. Register the intended account, then use the one-time bootstrap from an interactive PowerShell terminal in `backend/`:

```powershell
$env:ADMIN_BOOTSTRAP_ENABLED = "true"
$env:ADMIN_BOOTSTRAP_EMAIL = "admin@example.test"
npm run admin:bootstrap
Remove-Item Env:ADMIN_BOOTSTRAP_ENABLED
Remove-Item Env:ADMIN_BOOTSTRAP_EMAIL
```

The script prompts for the existing account password without echo. It promotes an existing account only, refuses if an admin already exists, and does not create an account or change its password. Do not put either opt-in variable in `.env`; clear them even if the command fails. Use a real institution-controlled address in deployment and secure the interactive terminal.

## Run the Applications

Open two PowerShell terminals.

Backend terminal:

```powershell
Set-Location backend
npm run dev
```

Frontend terminal:

```powershell
Set-Location frontend
npm run dev
```

The backend defaults to `http://localhost:3000`; Vite prints its frontend URL (normally `http://localhost:5173`). The Vite proxy forwards API paths, including `/reports`, to `API_PROXY_TARGET`. `/health` checks both the API and PostgreSQL. Swagger UI is available at `http://localhost:3000/docs`.

## Email OTP Verification

Configure all four required SMTP values in `backend/.env`, using a provider-issued SMTP hostname, port, user, password, and sender address. For implicit TLS use port 465; the current service selects secure transport for that port. Other SMTP ports use the provider's configured transport behavior. Restart the backend after changes.

Use the UI's Forgot password flow with an account you control. Verify that a six-digit code arrives, is rejected when wrong/expired, and allows a password reset only once. The request response deliberately does not reveal whether an email is registered. Without SMTP, reset email is not delivered; use a test mail server/provider in development rather than logging OTPs.

## File Storage and Authorized Downloads

Uploads are stored locally under `SUBMISSION_UPLOAD_DIR` (default `backend/var/private-uploads` when started from `backend/`). Only one PDF, JPEG, PNG, or WebP file up to 10 MiB can be attached to a submission. Test as a linked student, then verify the student can download their own file and another student cannot; faculty/admin access is subject to assignment/course authorization. The directory is private and ignored by Git.

Local disk is suitable only for single-instance development. Production requires durable private storage, backups, access policies, retention/deletion rules, and ideally content scanning; no object-storage adapter is included.

## PDF Reports

Signed-in faculty/admin users can download assignment and quiz reports from the UI or API:

- `GET /reports/assignments/{assignmentId}.pdf`
- `GET /reports/quizzes/{quizId}.pdf`

The endpoints return an attachment. Students and faculty without access to the relevant course are denied. Reports contain student identifiers and academic results; store/download them under the institution's data-handling policy.

## Tests and Quality Checks

Run the current scripts from the respective package directories:

```powershell
Set-Location backend
npm test
npm run build
npm run lint
npm run format:check
Set-Location ..\frontend
npm test
npm run build
npm run lint
```

Backend PostgreSQL integration tests require a disposable database configured for the tests. Do not point test runs at production. The packages expose no formatting script for the frontend; use its configured formatter policy only if one is added. No repository-wide root script combines backend and frontend checks.

Current baseline note: backend `npm run format:check` reports formatting differences in existing files outside this documentation/configuration change. The files changed for this task pass a scoped Prettier check; avoid bulk-formatting unrelated sources as part of setup.

## Troubleshooting

- **`DATABASE_URL` missing/invalid:** check `backend/.env`, ensure a PostgreSQL scheme, host, port, database, user, and password are correct, then restart.
- **Connection refused:** run `docker compose ps`; wait for PostgreSQL health or start the local PostgreSQL service. Check port 5432 availability.
- **Migration/client errors:** run `npx prisma migrate deploy` and `npx prisma generate` from `backend/` after confirming the database URL.
- **JWT startup error:** set a unique local `JWT_SECRET`; it is required outside tests.
- **OTP email not received:** confirm all four SMTP values are set, sender/provider policy permits the sender, port/TLS is correct, and inspect backend safe logs. Do not log or share OTPs.
- **Frontend API/network error:** confirm backend is listening at `API_PROXY_TARGET`, check the Vite proxy target and browser network panel, then restart Vite after editing `.env`.
- **Upload rejected:** check allowed PDF/JPEG/PNG/WebP MIME type, one-file limit, and 10 MiB maximum; ensure the storage directory is writable.
- **Report download denied:** sign in as faculty/admin and verify course ownership/access; direct report access is never public.
- **Port already in use:** change `PORT` or `API_PROXY_TARGET` consistently, and configure Vite's port separately if needed.

## Production Considerations

Use managed PostgreSQL with encrypted connections and least-privilege credentials; HTTPS; managed/rotatable secrets; configured SMTP; private persistent file storage; scheduled backups and tested restoration; controlled migration deployment; monitoring/alerting; retention/deletion policy; origin/CORS review; and vulnerability scans. Do not commit `.env`, secrets, uploaded work, reports, or database dumps. The repository currently has no production deployment manifests or formal SLOs.
