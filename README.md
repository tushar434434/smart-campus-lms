# Smart Campus LMS Backend

A modular, backend-focused Learning Management System built with **TypeScript, Fastify, and Prisma**. The system provides secure authentication, role-based access control, course and assignment management, and a submission and grading workflow.

The project emphasizes maintainable code, clear service boundaries, input validation, authorization, and automated testing.

## Features

### Authentication and Authorization

- User registration and login
- JWT-based authentication
- Secure password hashing with bcrypt
- Role-based access control for Students, Faculty, and Admins
- Protected API endpoints

### Academic Management

- Student record management
- Course management
- Assignment creation and management
- Assignment deadlines and maximum-mark validation

### Submission Workflow

- Create and retrieve assignment submissions
- Update submissions with ownership and permission checks
- Reject submissions after the assignment deadline
- Prevent modifications to graded submissions
- Validate grades against assignment limits
- Structured error responses for invalid operations

### Quality and Maintainability

- TypeScript for static type checking
- Zod-based request validation
- Modular application structure
- Automated tests with Vitest
- ESLint and Prettier for code quality and consistency

## Technology Stack

| Technology | Purpose                               |
| ---------- | ------------------------------------- |
| TypeScript | Type-safe application development     |
| Node.js    | JavaScript runtime                    |
| Fastify    | HTTP server and API framework         |
| PostgreSQL | Relational database                   |
| Prisma     | Database access and schema management |
| JWT        | Authentication                        |
| bcrypt     | Password hashing                      |
| Zod        | Input validation                      |
| Vitest     | Automated testing                     |
| ESLint     | Static analysis                       |
| Prettier   | Code formatting                       |

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
└── README.md
```

_The module list above illustrates the main structure; exact filenames may vary._

## Prerequisites

- Node.js and npm
- PostgreSQL, configured for your environment
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

Create a local `.env` file based on `.env.example` and supply the values required by the application.

```powershell
Copy-Item .env.example .env
```

Configure the database connection and authentication settings according to the project's environment configuration. Never commit real credentials or secrets.

### 4. Configure the database

Ensure PostgreSQL is running and the database connection is configured. Apply the Prisma setup or migrations required by the repository before starting the application.

### 5. Start the development server

```bash
npm run dev
```

## Available Commands

| Command                | Description                  |
| ---------------------- | ---------------------------- |
| `npm run dev`          | Start the development server |
| `npm run build`        | Compile TypeScript           |
| `npm start`            | Run the compiled application |
| `npm test`             | Run the automated test suite |
| `npm run lint`         | Run ESLint                   |
| `npm run format:check` | Check code formatting        |

## Testing and Validation

Run the following checks before submitting changes:

```bash
npm test
npm run lint
npm run build
git diff --check
```

The test suite covers application behavior and regression cases, including submission permissions, deadline enforcement, and grading-related rules.

## API Responses

The API uses structured JSON responses for successful operations and errors. Validation failures, authorization errors, missing resources, and invalid workflow operations should return appropriate HTTP status codes and error codes.

## Security Considerations

- Passwords are hashed rather than stored as plaintext.
- JWT authentication protects restricted endpoints.
- Authorization rules enforce role and resource ownership.
- Request validation helps reject invalid input.
- Environment-specific secrets must remain outside version control.

## Project Goals

Smart Campus LMS is designed as a practical backend engineering project demonstrating API development, authentication, authorization, business-rule enforcement, modular design, and automated testing.

## Future Improvements

- Expanded LMS workflows and assessment capabilities
- Additional integration and database tests
- API documentation and deployment configuration
- Monitoring, logging, and performance improvements

## License

No license has been specified yet. Add a `LICENSE` file if you intend to distribute the project under an open-source license.
