# Smart Campus LMS Backend

A modular, backend-focused Learning Management System built with **TypeScript, Fastify, Prisma, and PostgreSQL**. The project provides authentication, role-based authorization, academic resource management, and assignment submission and grading workflows.

The backend emphasizes maintainable architecture, input validation, secure access control, clear service boundaries, and automated testing.

## Features

### Authentication and Authorization
- User registration and login
- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control for students, faculty, and administrators
- Protected API endpoints

### Academic Management
- Student record management
- Course management
- Assignment creation and management
- Assignment deadline and maximum-mark validation

### Submission Workflow
- Create and retrieve assignment submissions
- Update submissions with ownership and permission checks
- Enforce assignment deadlines
- Protect graded submissions from unauthorized modification
- Validate grades against assignment limits
- Return structured errors for invalid operations

### Quality and Maintainability
- TypeScript static type checking
- Zod request validation
- Modular application structure
- Automated tests with Vitest
- ESLint and Prettier checks
- PostgreSQL integration testing

## Technology Stack

| Technology | Purpose |
|---|---|
| TypeScript | Type-safe application development |
| Node.js | JavaScript runtime |
| Fastify | HTTP server and API framework |
| PostgreSQL | Relational database |
| Prisma | Database access and schema management |
| JWT | Authentication |
| bcrypt | Password hashing |
| Zod | Request validation |
| Vitest | Automated testing |
| ESLint | Static analysis |
| Prettier | Code formatting |

## Project Structure

```text
backend/
├── src/
│   ├── modules/
│   │   ├── assignments/
│   │   ├── submissions/
│   │   └── ...
│   ├── app.ts
│   ├── server.ts
│   └── ...
├── tests/
├── prisma/
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── README.md
└── Screenshot 2026-10-26 112047.png
```

*This is an illustrative structure; the actual repository files are authoritative.*

## Prerequisites

- Node.js and npm
- PostgreSQL
- Git

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/tushar434434/smart-campus-lms.git
cd smart-campus-lms/backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a local `.env` file using `.env.example` as a reference.

In PowerShell:

```powershell
Copy-Item .env.example .env
```

Configure the required database connection and authentication variables. Never commit credentials or secrets.

### 4. Configure the database

Ensure PostgreSQL is running, configure the database connection, and apply the Prisma migrations or setup commands defined by the project.

### 5. Start the development server

```bash
npm run dev
```

## Available Commands

Run commands from the `backend` directory.

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Compile TypeScript |
| `npm start` | Run the compiled application |
| `npm test` | Run automated tests |
| `npm run lint` | Run ESLint |
| `npx prettier --check .` | Check formatting |

*Available scripts are defined in `package.json`.*

## Testing and Quality Checks

The automated test suite covers application behavior, regression cases, and PostgreSQL-backed integration scenarios.

Run the checks locally:

```bash
npm test
npm run build
npm run lint
npx prettier --check .
```

### Latest Verified Test Results

| Metric | Result |
|---|---:|
| Test files passed | 23 / 23 |
| Tests passed | 298 / 298 |
| Skipped tests | 0 |
| Test duration | 54.26 seconds |

The PostgreSQL integration tests cover database-backed quiz-attempt workflows, including answer persistence, grading, and submission behavior.

**Additional quality checks:** TypeScript build, ESLint, and Prettier passed in the reported verification run.

*Results reflect the latest recorded run and may change as the codebase evolves. PostgreSQL integration tests require a correctly configured test database and environment variables.*

### Test Run Screenshot

The following screenshot records the successful test run.

![Smart Campus LMS backend test results](./Screenshot%202026-10-26%20112047.png)

## API Responses

The API uses structured JSON responses for successful operations and errors. Validation failures, authorization errors, missing resources, and invalid workflow operations should return appropriate HTTP status codes and error codes.

## Security Considerations

- Passwords are hashed rather than stored as plaintext.
- JWT authentication protects restricted endpoints.
- Authorization rules enforce roles and resource ownership.
- Request validation helps reject invalid input.
- Environment-specific credentials must remain outside version control.

## Project Goals

Smart Campus LMS is a practical backend engineering project demonstrating API development, authentication, authorization, business-rule enforcement, modular design, database integration, and automated testing.

## Future Improvements

- Expand LMS workflows and assessment capabilities
- Add further integration and database tests
- Improve API documentation and deployment configuration
- Add monitoring, logging, and performance improvements

## License

No license has been specified yet. Add a `LICENSE` file if you intend to distribute the project under an open-source license.
