# Implementation Tracker

Priority order: bugs → authz → APIs/DB → frontend → quiz integrity → concurrency → performance → UI → release.

| ID | Area | Status | Notes |
| --- | --- | --- | --- |
| T1 | Account suspension | Done | `User.suspendedAt`; admin PATCH `/admin/users/:id/suspension`; login/JWT blocked |
| T2 | Self-service profile | Done | PATCH `/auth/me`, POST `/auth/change-password`; `/profile` UI |
| T3 | Unlink/relink | Done | PATCH `/students/:id/unlink-user`; faculty UI unlink |
| T4 | Quiz concurrent attempts | Done | Resume in-progress attempt; approved enrollment required; unique partial index |
| T5 | Bulk student import | Remaining | Not in current APIs |
| T6 | Email verification flag | Remaining | SMTP still optional |
| T7 | Object storage / malware scan | Remaining | Local disk uploads |
| T8 | Accessibility WCAG audit | Remaining | Layout exists; no formal audit |
| T9 | Load tests / SLOs | Remaining | No performance baseline |
| T10 | Browser E2E | Remaining | Vitest only |
| T11 | API.md course materials / enrollments | Remaining | Docs lag routes |
| T12 | Password-reset skip for suspended | Done | Suspended accounts get the generic reset response and no OTP |
| T13 | Quiz attempt student access | Done | Email-match auto-link for unlinked student profiles; approved enrollment still required; Prisma enrollment/publish errors mapped |
