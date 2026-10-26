# Smart Campus LMS frontend

React, TypeScript, and Vite application for the existing Smart Campus LMS API.

## Run locally

1. In a PowerShell terminal, start the backend from its own directory. It
   listens on port `3000` by default and requires PostgreSQL and JWT settings:

   ```powershell
   Set-Location 'C:\Users\tusha\smart-campus-lms\backend'
   npm install
   npm run dev
   ```

2. In a second PowerShell terminal, install and start the frontend:

   ```powershell
   Set-Location 'C:\Users\tusha\smart-campus-lms\frontend'
   npm install
   Copy-Item .env.example .env
   npm run dev
   ```

3. Open the Vite URL shown in the terminal. For local development, requests are
   proxied by Vite to `API_PROXY_TARGET` (default `http://localhost:3000`), so
   the browser does not need cross-origin CORS headers. `VITE_API_BASE_URL` is
   blank by default to use this same-origin proxy. If the backend uses another
   host or port, update `API_PROXY_TARGET`. For a production deployment, set
   `VITE_API_BASE_URL` to the API's public URL only when that server allows the
   frontend origin, or route API requests through a same-origin reverse proxy.
   Never put backend secrets in frontend environment variables.

## Checks

Run these commands from `frontend/`:

```powershell
npm run build
npm run lint
npm test
npm audit
```

## Integration notes

- API calls use the backend's `/auth`, `/courses`, `/students`,
  `/enrollments`, `/assignments`, `/submissions`, `/quizzes`, and quiz-attempt
  routes. Request and response shapes are typed in `src/types/api.ts`.
- JWTs are kept in memory only. Refreshing the page clears the session; a 401
  response signs the user out. Sign in again to continue.
- Course listing, staff student management and linking, enrollment, assignments,
  assignment submissions and grading for staff, quiz authoring, and quiz attempts
  are implemented where the backend supports them.
- Registration creates a login account, not a student record. Student access to
  their profile, course enrollment list, or own submissions is not available in
  the current backend API. A faculty member or administrator must create and
  link a student record; quiz attempt requests still require course enrollment.
  The interface identifies these limits rather than inventing records or data.
- Student-facing quiz result details follow the backend's release policy. The
  correct option is not included in the attempt question endpoint.
- The backend does not currently register CORS. The Vite development proxy
  handles local browser access without changing backend files.
