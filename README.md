# Smart Campus LMS

A backend-focused Learning Management System designed to address practical problems I experienced while using LMS platforms in college — including maintainability, access control, reliability, and online assessment security.

The project is being built step by step with a focus on **clean architecture, security, testing, and scalability**.

---

## Why I Am Building This

While using LMS platforms in college, I noticed that the challenges are not limited to the user interface.

When many students access an LMS around the same time, the backend needs to handle increasing traffic reliably. At the same time, different users such as students, faculty, and administrators require different permissions.

Online assessments also introduce another challenge: how can quizzes be made more controlled and reliable?

Instead of treating these as only UI problems, I wanted to understand them from a **backend engineering perspective**.

This project is my attempt to build an LMS from the backend up while learning how to design systems that are:

- Secure
- Maintainable
- Testable
- Modular
- Scalable
- Easier to extend

---

## Current Features

### Authentication

- User registration
- User login
- JWT-based authentication
- Password hashing with bcrypt
- Protected API routes
- Current-user endpoint

### Role-Based Access Control

The system currently supports:

- Student
- Faculty
- Admin

Different operations are protected based on user roles.

For example:

```text
Student
  └── Access student-specific resources

Faculty
  ├── Manage courses
  ├── Manage assignments
  └── Grade submissions

Admin
  └── Administrative operations
```
