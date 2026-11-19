import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app.js';
import { createTestContainer } from '../src/test-container.js';

describe('Course material routes', () => {
  let container: ReturnType<typeof createTestContainer>;
  let app: ReturnType<typeof buildApp>;
  const facultyId = randomUUID();
  const adminId = randomUUID();
  let facultyToken: string;
  let studentToken: string;
  let otherStudentToken: string;
  let courseId: string;
  let materialId: string;

  beforeEach(async () => {
    container = createTestContainer();
    app = buildApp(container);
    await app.ready();
    facultyToken = app.jwt.sign({ sub: facultyId, role: 'faculty' });

    const student = await container.studentRepository.create({
      name: 'Material Student',
      email: `material-${randomUUID()}@example.test`,
      department: 'Computer Science',
      semester: 4,
    });
    const user = await container.authRepository.create({
      name: student.name,
      email: student.email,
      passwordHash: 'test-hash',
      role: 'student',
    });
    await container.studentService.linkStudentUser(student.id, user.id);
    studentToken = app.jwt.sign({ sub: user.id, role: 'student' });

    const otherStudent = await container.studentRepository.create({
      name: 'Other Student',
      email: `other-${randomUUID()}@example.test`,
      department: 'Computer Science',
      semester: 4,
    });
    const otherUser = await container.authRepository.create({
      name: otherStudent.name,
      email: otherStudent.email,
      passwordHash: 'test-hash',
      role: 'student',
    });
    await container.studentService.linkStudentUser(
      otherStudent.id,
      otherUser.id,
    );
    otherStudentToken = app.jwt.sign({ sub: otherUser.id, role: 'student' });

    const course = await container.courseRepository.create(
      {
        title: 'Material Course',
        code: `MT${Math.floor(100 + Math.random() * 900)}`,
        credits: 3,
      },
      facultyId,
    );
    courseId = course.id;
    await container.courseService.approve(course.id, adminId);
    await container.enrollmentRepository.create({
      studentId: student.id,
      courseId,
      status: 'approved',
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('lets the owning faculty upload and an approved student view/download', async () => {
    const boundary = 'course-material-test-boundary';
    const pdf = '%PDF-1.7\ncourse notes';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="unit-one.pdf"',
      'Content-Type: application/pdf',
      '',
      pdf,
      `--${boundary}--`,
      '',
    ].join('\r\n');
    const uploaded = await app.inject({
      method: 'POST',
      url: `/courses/${courseId}/materials?title=Unit%201%20Notes&type=notes&unitNumber=1`,
      headers: {
        authorization: `Bearer ${facultyToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });

    expect(uploaded.statusCode, uploaded.body).toBe(201);
    expect(uploaded.json().data).toMatchObject({
      courseId,
      title: 'Unit 1 Notes',
      type: 'notes',
      unitNumber: 1,
      originalFileName: 'unit-one.pdf',
    });
    materialId = uploaded.json().data.id;

    const listed = await app.inject({
      method: 'GET',
      url: `/courses/${courseId}/materials`,
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().data).toHaveLength(1);
    expect(listed.json().data[0]).not.toHaveProperty('fileKey');

    const viewed = await app.inject({
      method: 'GET',
      url: `/course-materials/${materialId}/file`,
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(viewed.statusCode).toBe(200);
    expect(viewed.body).toContain(pdf);
    expect(viewed.headers['content-disposition']).toContain('inline');

    const downloaded = await app.inject({
      method: 'GET',
      url: `/course-materials/${materialId}/file?download=true`,
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(downloaded.headers['content-disposition']).toContain('attachment');

    const forbidden = await app.inject({
      method: 'GET',
      url: `/course-materials/${materialId}/file`,
      headers: { authorization: `Bearer ${otherStudentToken}` },
    });
    expect(forbidden.statusCode).toBe(403);
  });

  it('rejects upload by faculty who do not own the course and rejects spoofed file content', async () => {
    const otherFaculty = app.jwt.sign({ sub: randomUUID(), role: 'faculty' });
    const boundary = 'course-material-invalid-boundary';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="fake.pdf"',
      'Content-Type: application/pdf',
      '',
      'not a pdf',
      `--${boundary}--`,
      '',
    ].join('\r\n');
    const notOwner = await app.inject({
      method: 'POST',
      url: `/courses/${courseId}/materials?title=Bad%20Notes&type=notes`,
      headers: {
        authorization: `Bearer ${otherFaculty}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });
    expect(notOwner.statusCode).toBe(403);

    const invalidFile = await app.inject({
      method: 'POST',
      url: `/courses/${courseId}/materials?title=Bad%20Notes&type=notes`,
      headers: {
        authorization: `Bearer ${facultyToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });
    expect(invalidFile.statusCode).toBe(400);
    expect(invalidFile.json().error.code).toBe('INVALID_FILE_TYPE');
  });

  it('does not expose materials of a pending course to students', async () => {
    const pending = await container.courseRepository.create(
      {
        title: 'Pending Course',
        code: `PN${Math.floor(100 + Math.random() * 900)}`,
        credits: 2,
      },
      facultyId,
    );
    const response = await app.inject({
      method: 'GET',
      url: `/courses/${pending.id}/materials`,
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(response.statusCode).toBe(404);
  });
});
