# Development Handoff

## Completed task IDs

T1, T2, T3, T4, T12, T13, T14, T15

## Remaining task IDs

T5 (bulk import), T6 (email verification), T7 (object storage), T8 (a11y audit), T9 (load tests), T10 (E2E), T11 (API.md sync)

## Last modified files

- `backend/src/modules/quizzes/quiz.service.ts`
- `backend/src/modules/quizzes/quiz.routes.ts`
- `backend/tests/quiz.routes.test.ts`
- `backend/tests/quiz.service.test.ts`
- `frontend/src/api/quizzes.api.ts`
- `frontend/src/pages/QuizzesPage.tsx`
- `frontend/src/pages/QuizzesPage.test.tsx`

## Tests executed

Backend (T14 quiz start + question images):

```
cd backend
npx vitest run tests/quiz.routes.test.ts tests/quiz.service.test.ts tests/quiz-attempt.routes.test.ts tests/quiz-attempt.workflow.test.ts
npx tsc --noEmit --project tsconfig.build.json
npm run build
```

Frontend:

```
cd frontend
npx tsc -b --pretty false
npx vite build
```

## Known bugs

Students only saw quizzes for one selected course, so newly published quizzes on other enrolled courses did not show. `GET /quizzes/me` now returns every published quiz on approved enrollments as soon as faculty publishes. Unenrolled students get an empty list; staff cannot use that endpoint. Missing question image files still return 404 after the disk-storage fix.

## Exact next task

**T11** — document enrollment-request and course-material routes in `docs/API.md`. After that, **T5** bulk student import if still required.

## Commands needed to resume

```
cd backend
npx prisma migrate deploy
npx prisma generate
npm test
cd ../frontend
npm test
```
