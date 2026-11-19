# Smart Campus LMS API

## Scope and Conventions

This reference describes routes mounted by the feature-complete backend in `backend/`. Confirm a route in that source and/or at `/docs` before depending on it. The older root-level backend snapshot does not contain every route listed here. API base URL is `http://localhost:3000` by default.

Most JSON successes use `{ "success": true, "message": "...", "data": ... }`; some quiz-attempt endpoints use `{ "success": true, "data": ... }`. Errors generally use `{ "success": false, "error": { "code": "...", "message": "..." } }`, with `details` on some validation errors. Validation is HTTP 400; authentication 401; authorization 403; missing resources 404; conflicts 409; upload too large 413; rate limit 429. PDF and file downloads return binary bodies, not JSON. `/docs` serves Fastify Swagger UI.

Protected routes use `Authorization: Bearer <JWT>`. Login tokens expire after one hour. The API rechecks current roles for standard authorization paths. Request validation uses Zod and/or Fastify schemas; route-specific error details may vary.

Example login request and response (illustrative values only):

```http
POST /auth/login
Content-Type: application/json

{"email":"student@example.test","password":"example-password"}
```

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "<uuid>",
      "name": "Example Student",
      "email": "student@example.test",
      "role": "student"
    },
    "token": "<JWT>"
  }
}
```

## Route Inventory

`Public` means no bearer token is required. Role names are `student`, `faculty`, and `admin`; `Faculty/Admin` and `Admin` are backend-enforced.

### Health and authentication

| Method | Path                     | Access         | Behavior                                                                 |
| ------ | ------------------------ | -------------- | ------------------------------------------------------------------------ |
| GET    | `/health`                | Public         | Checks API process and PostgreSQL; 503 if DB query fails.                |
| POST   | `/auth/register`         | Public         | Creates a student-role account; ignores any requested role.              |
| POST   | `/auth/login`            | Public         | Verifies credentials and returns user plus one-hour JWT.                 |
| GET    | `/auth/me`               | Authenticated  | Returns current authenticated user's profile.                            |
| POST   | `/auth/forgot-password`  | Public; 5/min  | Requests a reset OTP; response is generic for known/unknown emails.      |
| POST   | `/auth/verify-reset-otp` | Public; 10/min | Verifies a six-digit OTP and returns a reset token.                      |
| POST   | `/auth/reset-password`   | Public; 5/min  | Consumes a reset token and sets a password of at least eight characters. |
| POST   | `/auth/change-password`  | Authenticated  | Changes authenticated user's password; requires `currentPassword` and `newPassword` (min 8 chars). |

OTP lifetime defaults to 10 minutes and is configurable from 1 to 30. A one-minute resend cooldown and five failed OTP attempts are enforced by the service. OTP digests and reset tokens are not returned in plaintext except the verified reset token to its requester.

### Administration

| Method | Path                               | Access | Behavior                                                                            |
| ------ | ---------------------------------- | ------ | ----------------------------------------------------------------------------------- |
| GET    | `/admin/dashboard/stats`           | Admin  | Returns dashboard counts.                                                           |
| GET    | `/admin/users`                     | Admin  | Paginated/searchable user list; `page`, `limit` (1-100), optional `search`, `role`. |
| GET    | `/admin/users/{userId}`            | Admin  | Reads a user.                                                                       |
| PATCH  | `/admin/users/{userId}/role`       | Admin  | Sets role to `student`, `faculty`, or `admin`; records audit event.                 |
| PATCH  | `/admin/users/{userId}/suspension` | Admin  | Toggles user suspension (`suspended: boolean`, optional `reason`); blocks login/JWT.|
| GET    | `/admin/role-audit-logs`           | Admin  | Paginated role-change audit history.                                                |
| GET    | `/admin/courses/pending-approval`  | Admin  | Lists courses awaiting admin approval.                                              |
| POST   | `/admin/courses/{id}/approve`      | Admin  | Approves a pending course for campus-wide visibility and enrollment.                |
| POST   | `/admin/courses/{id}/reject`       | Admin  | Rejects a pending course with a mandatory rejection reason (5-1,000 characters).    |

### Courses, students, and enrollment

| Method | Path                                      | Access        | Behavior                                                              |
| ------ | ----------------------------------------- | ------------- | --------------------------------------------------------------------- |
| GET    | `/courses`                                | Public        | Paginated/filterable course list (shows approved courses; faculty/admin can view their own pending/rejected). |
| GET    | `/courses/{id}`                           | Public        | Reads course detail.                                                  |
| POST   | `/courses`                                | Faculty/Admin | Creates a course; faculty-created courses require admin approval before publication. |
| PATCH  | `/courses/{id}`                           | Faculty/Admin | Updates an authorized course.                                         |
| DELETE | `/courses/{id}`                           | Admin         | Deletes a course.                                                     |
| GET    | `/courses/teaching`                       | Faculty       | Lists the current faculty member's courses.                           |
| PATCH  | `/courses/{id}/owner`                     | Admin         | Assigns or clears course faculty owner.                               |
| POST   | `/courses/{id}/resubmit`                  | Faculty       | Resubmits a rejected course for administrator review.                 |
| GET    | `/students/me`                            | Student       | Reads the linked current student's record.                            |
| POST   | `/students`                               | Faculty/Admin | Creates student record and generates enrollment number.               |
| GET    | `/students`                               | Faculty/Admin | Paginated/searchable student list.                                    |
| GET    | `/students/{id}`                          | Authenticated | Faculty/admin can read any record; student only their own.            |
| PATCH  | `/students/{id}`                          | Faculty/Admin | Updates student profile fields.                                       |
| DELETE | `/students/{id}`                          | Admin         | Deletes student record.                                               |
| GET    | `/students/{id}/linkable-users`           | Faculty/Admin | Lists eligible accounts to link to the student record.                |
| PATCH  | `/students/{id}/link-user`                | Faculty/Admin | Links a user account to a student record.                             |
| PATCH  | `/students/{id}/unlink-user`              | Faculty/Admin | Unlinks a user account from a student record.                         |
| GET    | `/enrollments/me`                         | Student       | Reads the current student's course enrollments and request status.    |
| POST   | `/courses/{courseId}/enrollment-requests` | Student       | Submits an enrollment request for an approved course.                 |
| GET    | `/enrollments/requests`                   | Faculty/Admin | Lists enrollment requests filtered by status (`pending`, `approved`, `rejected`). |
| POST   | `/enrollments/{id}/approve`               | Faculty/Admin | Approves an enrollment request.                                       |
| POST   | `/enrollments/{id}/reject`                | Faculty/Admin | Rejects an enrollment request with a mandatory reason (5-1,000 chars).|
| POST   | `/enrollments`                            | Faculty/Admin | Directly enrolls a student in a course.                               |
| GET    | `/enrollments/student/{studentId}`        | Faculty/Admin | Lists the student's course enrollments.                               |
| DELETE | `/enrollments/{id}`                       | Faculty/Admin | Removes an enrollment.                                                |

Enrollment number format is `<STUDENT_ENROLLMENT_PREFIX><year>-<six-digit sequence>`; default prefix is `SC`. The annual counter is transactionally incremented in PostgreSQL and the final number is unique.

### Course Materials

| Method | Path                            | Access        | Behavior                                                                                   |
| ------ | ------------------------------- | ------------- | ------------------------------------------------------------------------------------------ |
| POST   | `/courses/{courseId}/materials` | Faculty/Admin | Uploads a course material; multipart file up to 10 MiB; query params `title`, `type`, etc. |
| GET    | `/courses/{courseId}/materials` | Authenticated | Lists materials for a course; student requires approved enrollment in the course.          |
| GET    | `/course-materials/{id}/file`   | Authenticated | Streams or downloads (`?download=true`) material file with private no-store headers.       |
| DELETE | `/course-materials/{id}`        | Faculty/Admin | Deletes course material record and associated stored file.                                 |

### Assignments and submissions

| Method | Path                                            | Access        | Behavior                                                                                                                  |
| ------ | ----------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/assignments`                                  | Faculty/Admin | Creates an assignment for an authorized course.                                                                           |
| GET    | `/assignments/course/{courseId}`                | Authenticated | Lists assignments for a course subject to service access checks.                                                          |
| GET    | `/assignments/{id}`                             | Authenticated | Reads assignment subject to access checks.                                                                                |
| PATCH  | `/assignments/{id}`                             | Faculty/Admin | Updates an authorized assignment.                                                                                         |
| DELETE | `/assignments/{id}`                             | Admin         | Deletes assignment.                                                                                                       |
| POST   | `/submissions`                                  | Student       | Creates a submission for the linked student. JSON requires `studentId`, `assignmentId`, and `content` (minimum 10 chars). |
| GET    | `/submissions/me`                               | Student       | Reads current student's assignment activity.                                                                              |
| GET    | `/submissions/{id}`                             | Authenticated | Reads submission; student ownership is checked.                                                                           |
| GET    | `/submissions/student/{studentId}`              | Authenticated | Lists a student's submissions; access is checked.                                                                         |
| PATCH  | `/submissions/{id}`                             | Student       | Updates own ungraded submission subject to deadline/workflow rules.                                                       |
| PATCH  | `/submissions/{id}/grade`                       | Faculty/Admin | Grades submission; marks must be 0..assignment maximum; feedback max 1,000 characters.                                    |
| GET    | `/submissions/assignment/{assignmentId}`        | Faculty/Admin | Lists assignment submissions.                                                                                             |
| GET    | `/submissions/assignment/{assignmentId}/roster` | Faculty/Admin | Lists enrolled students and submission state, including non-submitters.                                                   |
| PUT    | `/submissions/{id}/file`                        | Student       | Multipart file upload; exactly one supported PDF/JPEG/PNG/WebP file, max 10 MiB.                                          |
| GET    | `/submissions/{id}/file`                        | Authenticated | Downloads only after service ownership/teaching authorization; private no-store response.                                 |

Illustrative upload: send `multipart/form-data` containing one file to `PUT /submissions/{id}/file` with the student's bearer token. No public file URL is created. Local storage uses opaque server-generated keys under `SUBMISSION_UPLOAD_DIR`.

### Quizzes and attempts

| Method | Path                                         | Access        | Behavior                                                                                     |
| ------ | -------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------- |
| POST   | `/quizzes`                                         | Faculty/Admin | Creates quiz with course, title, description, duration, marks, attempts, optional start/end. |
| GET    | `/courses/{courseId}/quizzes`                      | Authenticated | Lists course quizzes subject to service checks.                                              |
| GET    | `/quizzes/me`                                      | Student       | Lists all published quizzes across all of the student's approved course enrollments.         |
| GET    | `/quizzes/{id}`                                    | Authenticated | Reads quiz subject to service checks.                                                        |
| PATCH  | `/quizzes/{id}`                                    | Faculty/Admin | Updates quiz settings.                                                                       |
| DELETE | `/quizzes/{id}`                                    | Admin         | Deletes quiz.                                                                                |
| POST   | `/quizzes/{id}/publish`                            | Faculty/Admin | Publishes quiz after validating questions exist.                                             |
| POST   | `/quizzes/{id}/questions`                          | Faculty/Admin | Adds a multiple-choice or true/false question with answer key.                               |
| GET    | `/quizzes/{id}/questions`                          | Authenticated | Lists questions; correct answers are filtered according to role/result release.              |
| PATCH  | `/quizzes/{id}/questions/{questionId}`             | Faculty/Admin | Updates question text, options, or answer key.                                               |
| DELETE | `/quizzes/{id}/questions/{questionId}`             | Faculty/Admin | Deletes question.                                                                            |
| PUT    | `/quizzes/{id}/questions/{questionId}/images/{slot}`| Faculty/Admin| Uploads image file for `question` or options (`optionA`..`optionD`), max 10 MiB.             |
| GET    | `/quizzes/{id}/questions/{questionId}/images/{slot}`| Authenticated| Fetches question/option illustration; student requires approved course enrollment.          |
| POST   | `/quizzes/{id}/release-results`                    | Faculty/Admin | Configures whether marks/correct answers are released to students.                           |
| GET    | `/quizzes/{id}/attempts`                           | Authenticated | Gets attempt roster; service enforces role/course access.                                    |
| POST   | `/quizzes/{id}/attempts`                           | Student       | Starts attempt if enrolled, available, and below attempt limit.                              |
| GET    | `/attempts/me`                                     | Student       | Gets current student's quiz activity.                                                        |
| GET    | `/attempts/{attemptId}/questions`                  | Student       | Gets questions for own active attempt without hidden correct answers.                        |
| PUT    | `/attempts/{attemptId}/answers/{questionId}`       | Student       | Saves selected option `A`, `B`, `C`, or `D`.                                                 |
| PUT    | `/attempts/{attemptId}/bookmarks/{questionId}`     | Student       | Toggles bookmark flag on a question during an active attempt.                                |
| POST   | `/attempts/{attemptId}/submit`                     | Student       | Submits attempt and returns result data allowed by release settings.                         |
| GET    | `/attempts/{attemptId}/result`                     | Student       | Reads own submitted result subject to release policy.                                        |
| POST   | `/attempts/{attemptId}/proctoring-events`          | Student       | Records a supported event for own active attempt.                                            |

Quiz availability, enrollment, ownership, expiry, attempt count, and result visibility are service-enforced. Browser-reported proctoring events are activity signals, not proof against tampering.

### Reports

| Method | Path                            | Access        | Behavior                                                   |
| ------ | ------------------------------- | ------------- | ---------------------------------------------------------- |
| GET    | `/reports/assignments/{id}.pdf` | Faculty/Admin | Generates an A4 landscape assignment roster/progress PDF.  |
| GET    | `/reports/quizzes/{id}.pdf`     | Faculty/Admin | Generates an A4 landscape quiz roster/attempt summary PDF. |

Both routes return `application/pdf` attachments and apply service-level course access checks. Students are denied. Report data includes personally identifiable student and academic information.

## Illustrative Requests

Create a quiz question with a faculty/admin token:

```http
POST /quizzes/<quiz-uuid>/questions
Authorization: Bearer <JWT>
Content-Type: application/json

{"questionText":"Which option is correct?","optionA":"A","optionB":"B","optionC":"C","optionD":"D","correctOption":"B","marks":1}
```

Grade a submission:

```http
PATCH /submissions/<submission-uuid>/grade
Authorization: Bearer <JWT>
Content-Type: application/json

{"marks":18,"feedback":"Good analysis."}
```

## Validation and Security Notes

- UUID route parameters are validated where implemented; query pagination is bounded (typically max 100).
- Registration requires name (minimum three characters), valid email, and password (minimum eight characters); public role assignment is not supported.
- Course codes use 2-5 uppercase letters followed by 3-4 digits; credits range 1-6.
- Submission content requires at least ten characters; file maximum is 10 MiB; grades cannot exceed assignment maximum.
- Quiz questions require non-empty A-D options and a correct option from A-D; marks and duration are positive; end time must follow start time.
- OTP endpoints use generic reset-request responses, fixed request limits, expiry, cooldown, and attempt limits.
- Do not send secrets in query strings or include passwords, OTPs, reset tokens, or authorization headers in logs or support reports.
