# Smart Campus LMS

Smart Campus LMS is a modern, modular, role-based Learning Management System designed for higher education institutions. Built with a type-safe **TypeScript, Fastify, Prisma ORM, and PostgreSQL** backend and a responsive **React 19, Vite, and TailwindCSS** frontend, it provides comprehensive workflows for academic administration, course delivery, continuous assessment, and student learning.

---

## Architecture and Highlights

- **Role-Based Access Control (RBAC):** Strict permissions for `admin`, `faculty`, and `student` roles, with authorization checks re-validated on every request.
- **Course Lifecycle & Approval:** Faculty create courses with syllabus and credit details; administrators review, approve, or reject with detailed feedback before courses enter the campus catalog.
- **Course Materials Management:** Faculty upload lecture notes, slides, and syllabus files (up to 10 MiB) with secure, streaming downloads for enrolled students.
- **Student Enrollment Requests:** Students browse approved courses, submit enrollment requests, and track approval status in real time; faculty and administrators review, approve, or reject applications.
- **Assignment & Private Submissions:** Complete lifecycle for homework and projects—deadline enforcement, file uploads (PDF/JPEG/PNG/WebP), rubric grading, and feedback delivery.
- **Assessment Engine (Quizzes):** Timed assessments supporting Multiple Choice and True/False questions, question/option illustration images, question bookmarking, attempt resumption, automated scoring, and granular results release controls.
- **PDF Report Generation:** Automated server-side generation of A4 landscape PDF gradebooks and rosters for assignments and quizzes.
- **Administrative Operations:** Real-time campus KPI dashboard, user search and role assignment, account suspension, and immutable audit logs.
- **Account Security:** Bcrypt password hashing, JWT bearer tokens, self-service password changes, and rate-limited 6-digit OTP password recovery with cooldown periods.

---

## Documentation

Full architectural and developer documentation is located in the `docs/` folder:

- **[Project Requirements](docs/PROJECT_REQUIREMENTS.md):** Functional specifications, role definitions, and business rules.
- **[Architecture & Design](docs/ARCHITECTURE.md):** Clean architecture layers, repository patterns, domain models, and data flows.
- **[Development Setup](docs/DEVELOPMENT_SETUP.md):** Node/PostgreSQL prerequisites, Prisma migrations, Docker setup, and seed scripts.
- **[API Reference](docs/API.md):** Detailed endpoint catalogue, request/response schemas, error codes, and authentication requirements.

---

## Technology Stack

### Backend
| Technology | Description |
|---|---|
| **Node.js & TypeScript** | Strict type-safety, ESM modules, and modern JavaScript runtime |
| **Fastify** | High-performance, low-overhead HTTP web framework with plugin architecture |
| **Prisma ORM** | Schema-first database modeling, migrations, and type-safe query generation |
| **PostgreSQL** | ACID-compliant relational persistence with unique constraints and partial indexes |
| **Zod** | Runtime schema validation for requests, query parameters, and configuration |
| **Bcrypt & Fastify JWT** | Secure password hashing, token generation, and role claims verification |
| **Vitest** | Blazing-fast unit and integration testing runner |

### Frontend
| Technology | Description |
|---|---|
| **React 19** | Modern UI framework with hooks and functional components |
| **Vite** | Next-generation frontend build tooling and HMR dev server |
| **React Router v7** | Declarative client-side routing with role-based route protection |
| **TailwindCSS & CSS Modules** | Responsive campus styling, design tokens, and clean layout patterns |
| **Lucide React** | Accessible, consistent iconography |
| **Testing Library & jsdom** | Component regression tests and asynchronous user interaction verification |

---

## Project Structure

```text
smart-campus-lms/
├── backend/                       # Primary, feature-complete API server
│   ├── prisma/
│   │   ├── schema.prisma          # Database schema (Users, Students, Courses, Quizzes, etc.)
│   │   └── migrations/            # Version-controlled SQL migration scripts
│   ├── src/
│   │   ├── config/                # Environment configuration and validation
│   │   ├── middleware/            # JWT authentication and RBAC authorization
│   │   ├── modules/
│   │   │   ├── admin/             # Dashboard metrics, user role management, audit logs
│   │   │   ├── auth/              # Register, login, password reset OTP, suspension check
│   │   │   ├── assignments/       # Assignment creation, updating, deadlines
│   │   │   ├── submissions/       # Submission upload, download, rubric grading
│   │   │   ├── courses/           # Catalog, course approval workflow, course materials
│   │   │   ├── enrollments/       # Student enrollment requests and approvals
│   │   │   ├── students/          # Student records, enrollment numbers, account linking
│   │   │   ├── quizzes/           # Quiz creation, question image management, publishing
│   │   │   ├── quiz-attempts/     # Active attempts, bookmarks, proctoring events, scoring
│   │   │   └── reports/           # PDF gradebook and roster export
│   │   ├── app.ts                 # Fastify instance builder and plugin registrations
│   │   └── server.ts              # Production HTTP server entry point
│   └── tests/                     # Unit, route, service, and PostgreSQL integration tests
├── frontend/                      # React / Vite SPA web client
│   ├── src/
│   │   ├── api/                   # Type-safe API client wrappers
│   │   ├── components/            # Reusable UI widgets, panels, and layouts
│   │   ├── contexts/              # Authentication and session state
│   │   ├── pages/                 # Route views (Dashboard, Courses, Quizzes, Admin, etc.)
│   │   └── types/                 # TypeScript interfaces for campus entities
│   └── tests/                     # Vitest component and page interaction suites
├── docs/                          # Architecture, API, and setup documentation
├── DEVELOPMENT_HANDOFF.md         # Operational status and task handoff logs
└── IMPLEMENTATION_TRACKER.md      # Feature implementation tracking checklist
```

---

## Quick Start

### 1. Prerequisites
- **Node.js:** v20.x or v22.x LTS
- **PostgreSQL:** v15+ or running via Docker
- **npm:** v10+

### 2. Configure Backend
Navigate to the `backend/` directory:
```bash
cd backend
cp .env.example .env
```
Ensure database connection parameters match your PostgreSQL server:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/smart_campus_lms?schema=public"
JWT_SECRET="super-secret-jwt-key-replace-in-production"
PORT=3000
```

Install dependencies, run migrations, and start the development server:
```bash
npm install
npx prisma migrate deploy
npx prisma generate
npm run dev
```
The API is available at `http://localhost:3000` with Swagger documentation at `http://localhost:3000/docs`.

### 3. Configure Frontend
Open a new terminal in the `frontend/` directory:
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```
The student and faculty workspace is accessible at `http://localhost:5173`.

---

## Testing & Quality Checks

Run the automated suites to verify correctness:

### Backend Checks
```bash
cd backend
npm test                           # Run all 380+ unit, service, and route tests
npm run build                      # Compile TypeScript to dist/
```

### Frontend Checks
```bash
cd frontend
npm test                           # Run all 11 Vitest component suites
npm run lint                       # ESLint verification
npm run build                      # TypeScript check and production bundle build
```

---

## Security Best Practices

- All passwords are encrypted with salted `bcrypt` hashes.
- Access tokens expire in 1 hour; sensitive role changes take effect immediately on next token re-verification.
- File uploads for assignments, course materials, and quiz illustrations are validated for MIME type, file extension, and size limits (10 MiB) and served with `private, no-store` caching headers.
- Student account linking enforces uniqueness to prevent profile collision or unauthorized record access.
- Suspended user accounts are immediately denied login and token authentication.
