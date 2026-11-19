import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createTestContainer } from '../src/test-container.js';

describe('Quiz Routes', () => {
  let app: ReturnType<typeof buildApp>;
  let courseId: string;
  let facultyToken: string;
  let adminToken: string;
  let studentToken: string;

  const validQuiz = () => ({
    courseId,
    title: 'Data Structures Quiz',
    description: 'Assessment covering arrays and linked lists',
    durationMinutes: 30,
    maxMarks: 20,
    maxAttempts: 2,
  });

  beforeEach(async () => {
    app = buildApp(createTestContainer());
    await app.ready();

    facultyToken = app.jwt.sign({
      sub: 'faculty-test-id',
      role: 'faculty',
    });

    adminToken = app.jwt.sign({
      sub: 'admin-test-id',
      role: 'admin',
    });

    studentToken = app.jwt.sign({
      sub: 'student-test-id',
      role: 'student',
    });

    const courseResponse = await app.inject({
      method: 'POST',
      url: '/courses',
      headers: {
        authorization: `Bearer ${facultyToken}`,
      },
      payload: {
        title: 'Data Structures',
        code: `CS${Math.floor(Math.random() * 9000) + 1000}`,
        credits: 4,
      },
    });

    expect(courseResponse.statusCode).toBe(201);
    courseId = courseResponse.json().data.id;
  });

  afterEach(async () => {
    await app.close();
  });

  it('should reject publishing a draft quiz without questions', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/quizzes',
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: validQuiz(),
    });

    expect(created.statusCode).toBe(201);

    const quizId = created.json().data.id;

    const response = await app.inject({
      method: 'POST',
      url: `/quizzes/${quizId}/publish`,
      headers: { authorization: `Bearer ${facultyToken}` },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('QUIZ_HAS_NO_QUESTIONS');

    const quizResponse = await app.inject({
      method: 'GET',
      url: `/quizzes/${quizId}`,
      headers: { authorization: `Bearer ${facultyToken}` },
    });

    expect(quizResponse.statusCode).toBe(200);
    expect(quizResponse.json().data.status).toBe('draft');
  });

  it('should reject publishing a quiz without questions', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/quizzes',
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: validQuiz(),
    });

    expect(created.statusCode).toBe(201);

    const response = await app.inject({
      method: 'POST',
      url: `/quizzes/${created.json().data.id}/publish`,
      headers: { authorization: `Bearer ${facultyToken}` },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('QUIZ_HAS_NO_QUESTIONS');
  });

  it('should reject quiz publishing by a student', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/quizzes',
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: validQuiz(),
    });

    const response = await app.inject({
      method: 'POST',
      url: `/quizzes/${created.json().data.id}/publish`,
      headers: { authorization: `Bearer ${studentToken}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it('should return 404 when publishing a nonexistent quiz', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/quizzes/${randomUUID()}/publish`,
      headers: { authorization: `Bearer ${facultyToken}` },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('QUIZ_NOT_FOUND');
  });

  it('should create a quiz', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/quizzes',
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: validQuiz(),
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.title).toBe('Data Structures Quiz');
  });

  it('secures quiz question image upload and retrieval', async () => {
    const quiz = await app.inject({
      method: 'POST',
      url: '/quizzes',
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: validQuiz(),
    });
    const quizId = quiz.json().data.id as string;
    const question = await app.inject({
      method: 'POST',
      url: `/quizzes/${quizId}/questions`,
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: {
        questionText: 'Identify this diagram',
        optionA: 'A',
        optionB: 'B',
        optionC: 'C',
        optionD: 'D',
        correctOption: 'A',
        marks: 1,
      },
    });
    const questionId = question.json().data.id as string;
    const boundary = 'quiz-image-test-boundary';
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
    ]);
    const body = Buffer.concat([
      Buffer.from(
        [
          `--${boundary}\r\n`,
          'Content-Disposition: form-data; name="file"; filename="diagram.png"\r\n',
          'Content-Type: image/png\r\n\r\n',
        ].join(''),
      ),
      png,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const uploaded = await app.inject({
      method: 'PUT',
      url: `/quizzes/${quizId}/questions/${questionId}/images/question`,
      headers: {
        authorization: `Bearer ${facultyToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });
    expect(uploaded.statusCode, uploaded.body).toBe(200);
    expect(uploaded.json().data).toMatchObject({
      slot: 'question',
      mimeType: 'image/png',
    });

    const retrieved = await app.inject({
      method: 'GET',
      url: `/quizzes/${quizId}/questions/${questionId}/images/question`,
      headers: { authorization: `Bearer ${facultyToken}` },
    });
    expect(retrieved.statusCode).toBe(200);
    expect(retrieved.headers['content-type']).toContain('image/png');

    const forbidden = await app.inject({
      method: 'PUT',
      url: `/quizzes/${quizId}/questions/${questionId}/images/optionA`,
      headers: {
        authorization: `Bearer ${studentToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });
    expect(forbidden.statusCode).toBe(403);
  });

  it('should prevent faculty from creating quizzes in another faculty member’s course', async () => {
    const otherFacultyToken = app.jwt.sign({
      sub: 'other-faculty-test-id',
      role: 'faculty',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/quizzes',
      headers: { authorization: 'Bearer ' + otherFacultyToken },
      payload: validQuiz(),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
  });

  it('should reject quiz creation without authentication', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/quizzes',
      payload: validQuiz(),
    });

    expect(response.statusCode).toBe(401);
  });

  it('should reject quiz creation by a student', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/quizzes',
      headers: { authorization: `Bearer ${studentToken}` },
      payload: validQuiz(),
    });

    expect(response.statusCode).toBe(403);
  });

  it('should reject invalid quiz input', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/quizzes',
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: {
        ...validQuiz(),
        title: 'A',
        durationMinutes: -1,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject a quiz for a nonexistent course', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/quizzes',
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: { ...validQuiz(), courseId: randomUUID() },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('COURSE_NOT_FOUND');
  });

  it('should retrieve a quiz by ID', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/quizzes',
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: validQuiz(),
    });

    const id = created.json().data.id;

    const response = await app.inject({
      method: 'GET',
      url: `/quizzes/${id}`,
      headers: { authorization: `Bearer ${facultyToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.id).toBe(id);
  });

  it('should reject retrieval without authentication', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/quizzes/${randomUUID()}`,
    });

    expect(response.statusCode).toBe(401);
  });

  it('should return 404 for a nonexistent quiz', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/quizzes/${randomUUID()}`,
      headers: { authorization: `Bearer ${facultyToken}` },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('QUIZ_NOT_FOUND');
  });

  it('should list quizzes for a course', async () => {
    await app.inject({
      method: 'POST',
      url: '/quizzes',
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: validQuiz(),
    });

    const response = await app.inject({
      method: 'GET',
      url: `/courses/${courseId}/quizzes`,
      headers: { authorization: `Bearer ${facultyToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toHaveLength(1);
  });

  it('should reject an invalid course ID', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/courses/not-a-uuid/quizzes',
      headers: { authorization: `Bearer ${facultyToken}` },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should update a quiz', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/quizzes',
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: validQuiz(),
    });

    const id = created.json().data.id;

    const response = await app.inject({
      method: 'PATCH',
      url: `/quizzes/${id}`,
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: { title: 'Updated Quiz Title' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.title).toBe('Updated Quiz Title');
  });

  it('should reject quiz updates by a student', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/quizzes/${randomUUID()}`,
      headers: { authorization: `Bearer ${studentToken}` },
      payload: { title: 'Updated Quiz Title' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('should reject invalid quiz updates', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/quizzes',
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: validQuiz(),
    });

    const response = await app.inject({
      method: 'PATCH',
      url: `/quizzes/${created.json().data.id}`,
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: { title: 'A' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should return 404 when updating a nonexistent quiz', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/quizzes/${randomUUID()}`,
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: { title: 'Updated Quiz Title' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('QUIZ_NOT_FOUND');
  });

  it('should delete a quiz as admin', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/quizzes',
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: validQuiz(),
    });

    const id = created.json().data.id;

    const response = await app.inject({
      method: 'DELETE',
      url: `/quizzes/${id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
  });

  it('should reject quiz deletion by faculty', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: `/quizzes/${randomUUID()}`,
      headers: { authorization: `Bearer ${facultyToken}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it('should return 404 when deleting a nonexistent quiz', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: `/quizzes/${randomUUID()}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('QUIZ_NOT_FOUND');
  });
});

describe('student quiz listing', () => {
  let app: ReturnType<typeof buildApp>;
  let container: ReturnType<typeof createTestContainer>;
  let courseId: string;
  let facultyToken: string;
  let adminToken: string;
  let studentToken: string;
  let otherStudentToken: string;

  const question = {
    questionText: 'What is 2 + 2?',
    optionA: '3',
    optionB: '4',
    optionC: '5',
    optionD: '6',
    correctOption: 'B',
    marks: 10,
  };

  beforeEach(async () => {
    container = createTestContainer();
    app = buildApp(container);
    await app.ready();
    facultyToken = app.jwt.sign({ sub: 'faculty-owner', role: 'faculty' });
    adminToken = app.jwt.sign({ sub: 'admin-owner', role: 'admin' });
    const course = await app.inject({
      method: 'POST',
      url: '/courses',
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: { title: 'Networks', code: 'CS601', credits: 3 },
    });
    courseId = course.json().data.id;
    const approved = await app.inject({
      method: 'POST',
      url: `/admin/courses/${courseId}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(approved.statusCode).toBe(200);

    const student = await app.inject({
      method: 'POST',
      url: '/students',
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: {
        name: 'Quiz Student',
        email: `quiz-${randomUUID()}@example.test`,
        department: 'CSE',
        semester: 6,
      },
    });
    const studentRecordId = student.json().data.id as string;
    const studentUser = await container.authRepository.create({
      name: 'Quiz Student',
      email: `quiz-user-${randomUUID()}@example.test`,
      passwordHash: 'test-hash',
      role: 'student',
    });
    await container.studentService.linkStudentUser(
      studentRecordId,
      studentUser.id,
    );
    studentToken = app.jwt.sign({ sub: studentUser.id, role: 'student' });
    await container.enrollmentRepository.create({
      studentId: studentRecordId,
      courseId,
      status: 'approved',
    });

    const outsider = await container.authRepository.create({
      name: 'Other Student',
      email: `other-${randomUUID()}@example.test`,
      passwordHash: 'test-hash',
      role: 'student',
    });
    const outsiderRecord = await container.studentRepository.create({
      name: 'Other Student',
      email: outsider.email,
      department: 'CSE',
      semester: 6,
    });
    await container.studentRepository.linkUser(outsiderRecord.id, outsider.id);
    otherStudentToken = app.jwt.sign({ sub: outsider.id, role: 'student' });
  });

  afterEach(async () => {
    await app.close();
  });

  it('lists published quizzes for an enrolled student and hides drafts', async () => {
    const draft = await app.inject({
      method: 'POST',
      url: '/quizzes',
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: {
        courseId,
        title: 'Hidden draft',
        description: 'Should not appear',
        durationMinutes: 15,
        maxMarks: 10,
        maxAttempts: 1,
      },
    });
    expect(draft.statusCode).toBe(201);
    const published = await app.inject({
      method: 'POST',
      url: '/quizzes',
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: {
        courseId,
        title: 'Visible quiz',
        description: 'Published assessment',
        durationMinutes: 20,
        maxMarks: 10,
        maxAttempts: 1,
      },
    });
    const quizId = published.json().data.id as string;
    const added = await app.inject({
      method: 'POST',
      url: `/quizzes/${quizId}/questions`,
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: question,
    });
    expect(added.statusCode).toBe(201);
    const publishedQuiz = await app.inject({
      method: 'POST',
      url: `/quizzes/${quizId}/publish`,
      headers: { authorization: `Bearer ${facultyToken}` },
    });
    expect(publishedQuiz.statusCode).toBe(200);

    const listed = await app.inject({
      method: 'GET',
      url: `/courses/${courseId}/quizzes`,
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().data).toEqual([
      expect.objectContaining({
        id: quizId,
        title: 'Visible quiz',
        status: 'published',
      }),
    ]);

    const mine = await app.inject({
      method: 'GET',
      url: '/quizzes/me',
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(mine.statusCode).toBe(200);
    expect(mine.json().data.map((quiz: { id: string }) => quiz.id)).toEqual([
      quizId,
    ]);
    expect(mine.json().data.map((quiz: { id: string }) => quiz.id)).not.toContain(
      draft.json().data.id,
    );
  });

  it('rejects the student quiz list when the account is not linked', async () => {
    const unlinkedToken = app.jwt.sign({
      sub: randomUUID(),
      role: 'student',
    });
    const response = await app.inject({
      method: 'GET',
      url: '/quizzes/me',
      headers: { authorization: `Bearer ${unlinkedToken}` },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('STUDENT_NOT_LINKED');
  });

  it('rejects quiz listing when the student is not enrolled', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/courses/${courseId}/quizzes`,
      headers: { authorization: `Bearer ${otherStudentToken}` },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('NOT_ENROLLED');
  });

  it('includes a quiz in the student account list as soon as it is published', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/quizzes',
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: {
        courseId,
        title: 'Freshly published quiz',
        description: 'Should appear for enrolled students',
        durationMinutes: 20,
        maxMarks: 10,
        maxAttempts: 1,
      },
    });
    const quizId = created.json().data.id as string;
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/quizzes/${quizId}/questions`,
          headers: { authorization: `Bearer ${facultyToken}` },
          payload: question,
        })
      ).statusCode,
    ).toBe(201);

    const beforePublish = await app.inject({
      method: 'GET',
      url: '/quizzes/me',
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(beforePublish.statusCode).toBe(200);
    expect(beforePublish.json().data.map((quiz: { id: string }) => quiz.id)).not.toContain(
      quizId,
    );

    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/quizzes/${quizId}/publish`,
          headers: { authorization: `Bearer ${facultyToken}` },
        })
      ).statusCode,
    ).toBe(200);

    const afterPublish = await app.inject({
      method: 'GET',
      url: '/quizzes/me',
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(afterPublish.statusCode).toBe(200);
    expect(afterPublish.json().data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: quizId,
          title: 'Freshly published quiz',
          status: 'published',
        }),
      ]),
    );

    const outsider = await app.inject({
      method: 'GET',
      url: '/quizzes/me',
      headers: { authorization: `Bearer ${otherStudentToken}` },
    });
    expect(outsider.statusCode).toBe(200);
    expect(outsider.json().data.map((quiz: { id: string }) => quiz.id)).not.toContain(
      quizId,
    );

    const facultyDenied = await app.inject({
      method: 'GET',
      url: '/quizzes/me',
      headers: { authorization: `Bearer ${facultyToken}` },
    });
    expect(facultyDenied.statusCode).toBe(403);
  });

  it('lets an enrolled linked student start a published quiz', async () => {
    const published = await app.inject({
      method: 'POST',
      url: '/quizzes',
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: {
        courseId,
        title: 'Attempt quiz',
        description: 'Published assessment',
        durationMinutes: 20,
        maxMarks: 10,
        maxAttempts: 1,
      },
    });
    const quizId = published.json().data.id as string;
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/quizzes/${quizId}/questions`,
          headers: { authorization: `Bearer ${facultyToken}` },
          payload: question,
        })
      ).statusCode,
    ).toBe(201);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/quizzes/${quizId}/publish`,
          headers: { authorization: `Bearer ${facultyToken}` },
        })
      ).statusCode,
    ).toBe(200);

    const started = await app.inject({
      method: 'POST',
      url: `/quizzes/${quizId}/attempts`,
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(started.statusCode).toBe(201);
    expect(started.json().data.status).toBe('in_progress');

    const denied = await app.inject({
      method: 'POST',
      url: `/quizzes/${quizId}/attempts`,
      headers: { authorization: `Bearer ${otherStudentToken}` },
    });
    expect(denied.statusCode).toBe(403);
    expect(denied.json().error.code).toBe('NOT_ENROLLED');
  });

  it('serves quiz question images to enrolled students and 404s missing files', async () => {
    const published = await app.inject({
      method: 'POST',
      url: '/quizzes',
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: {
        courseId,
        title: 'Image quiz',
        description: 'Has a diagram',
        durationMinutes: 20,
        maxMarks: 10,
        maxAttempts: 1,
      },
    });
    const quizId = published.json().data.id as string;
    const createdQuestion = await app.inject({
      method: 'POST',
      url: `/quizzes/${quizId}/questions`,
      headers: { authorization: `Bearer ${facultyToken}` },
      payload: question,
    });
    const questionId = createdQuestion.json().data.id as string;
    const boundary = 'quiz-image-enrolled-boundary';
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
    ]);
    const body = Buffer.concat([
      Buffer.from(
        [
          `--${boundary}\r\n`,
          'Content-Disposition: form-data; name="file"; filename="diagram.png"\r\n',
          'Content-Type: image/png\r\n\r\n',
        ].join(''),
      ),
      png,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const uploaded = await app.inject({
      method: 'PUT',
      url: `/quizzes/${quizId}/questions/${questionId}/images/question`,
      headers: {
        authorization: `Bearer ${facultyToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });
    expect(uploaded.statusCode, uploaded.body).toBe(200);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/quizzes/${quizId}/publish`,
          headers: { authorization: `Bearer ${facultyToken}` },
        })
      ).statusCode,
    ).toBe(200);

    const retrieved = await app.inject({
      method: 'GET',
      url: `/quizzes/${quizId}/questions/${questionId}/images/question`,
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(retrieved.statusCode).toBe(200);
    expect(retrieved.headers['content-type']).toContain('image/png');

    const forbidden = await app.inject({
      method: 'GET',
      url: `/quizzes/${quizId}/questions/${questionId}/images/question`,
      headers: { authorization: `Bearer ${otherStudentToken}` },
    });
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json().error.code).toBe('NOT_ENROLLED');

    const stored = await container.quizRepository.findQuestionImage(
      questionId,
      'question',
    );
    expect(stored).toBeDefined();
    await container.quizImageStorage.remove(stored!.fileKey);

    const missing = await app.inject({
      method: 'GET',
      url: `/quizzes/${quizId}/questions/${questionId}/images/question`,
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('QUESTION_IMAGE_NOT_FOUND');
  });
});
