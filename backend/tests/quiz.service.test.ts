import { describe, expect, it } from 'vitest';
import { InMemoryCourseRepository } from '../src/modules/courses/course.repository.js';
import { InMemoryEnrollmentRepository } from '../src/modules/enrollments/enrollment.repository.js';
import { InMemoryQuizRepository } from '../src/modules/quizzes/quiz.repository.js';
import { QuizService } from '../src/modules/quizzes/quiz.service.js';
import { InMemoryAuthRepository } from '../src/modules/auth/auth.repository.js';
import { InMemoryStudentRepository } from '../src/modules/students/student.repository.js';

async function setup() {
  const courses = new InMemoryCourseRepository();
  const enrollments = new InMemoryEnrollmentRepository();
  const quizzes = new InMemoryQuizRepository();
  const students = new InMemoryStudentRepository();
  const service = new QuizService(
    quizzes,
    courses,
    enrollments,
    students,
  );
  const faculty = { sub: 'faculty-1', role: 'faculty' as const };
  const studentUser = { sub: 'user-student-1', role: 'student' as const };
  const course = await courses.create(
    { title: 'Algorithms', code: 'CS401', credits: 4 },
    faculty.sub,
  );
  await courses.approvePending(course.id, 'admin-1');
  const student = await students.create({
    name: 'Enrolled Student',
    email: 'enrolled@example.test',
    department: 'CSE',
    semester: 4,
  });
  await students.linkUser(student.id, studentUser.sub);
  await enrollments.create({
    studentId: student.id,
    courseId: course.id,
    status: 'approved',
  });
  const draft = await service.create(
    {
      courseId: course.id,
      title: 'Draft quiz',
      description: 'Not visible yet',
      durationMinutes: 20,
      maxMarks: 10,
      maxAttempts: 1,
    },
    faculty,
  );
  const published = await service.create(
    {
      courseId: course.id,
      title: 'Published quiz',
      description: 'Visible assessment',
      durationMinutes: 30,
      maxMarks: 20,
      maxAttempts: 1,
    },
    faculty,
  );
  await quizzes.createQuestion(published.id, {
    questionType: 'multiple_choice',
    questionText: 'What is 2 + 2?',
    optionA: '3',
    optionB: '4',
    optionC: '5',
    optionD: '6',
    correctOption: 'B',
    marks: 20,
  });
  await service.publish(published.id, faculty);
  return {
    service,
    courses,
    enrollments,
    students,
    course,
    faculty,
    studentUser,
    draft,
    published,
  };
}

describe('QuizService student listing', () => {
  it('returns only published quizzes to an enrolled student', async () => {
    const { service, course, studentUser, published } = await setup();
    const listed = await service.getAllByCourseId(course.id, studentUser);
    expect(listed.map((quiz) => quiz.id)).toEqual([published.id]);
    expect(listed.every((quiz) => quiz.status === 'published')).toBe(true);
  });

  it('keeps draft quizzes visible to the teaching faculty', async () => {
    const { service, course, faculty, draft, published } = await setup();
    const listed = await service.getAllByCourseId(course.id, faculty);
    expect(listed.map((quiz) => quiz.id).sort()).toEqual(
      [draft.id, published.id].sort(),
    );
  });

  it('rejects students without approved enrollment', async () => {
    const { service, course } = await setup();
    await expect(
      service.getAllByCourseId(course.id, {
        sub: 'other-user',
        role: 'student',
      }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'STUDENT_NOT_LINKED' });
  });

  it('links a matching student account before checking approved enrollment', async () => {
    const courses = new InMemoryCourseRepository();
    const enrollments = new InMemoryEnrollmentRepository();
    const quizzes = new InMemoryQuizRepository();
    const students = new InMemoryStudentRepository();
    const accounts = new InMemoryAuthRepository();
    const service = new QuizService(
      quizzes,
      courses,
      enrollments,
      students,
      { authRepository: accounts },
    );
    const faculty = { sub: 'faculty-1', role: 'faculty' as const };
    const course = await courses.create(
      { title: 'Networks', code: 'CS402', credits: 3 },
      faculty.sub,
    );
    await courses.approvePending(course.id, 'admin-1');
    const student = await students.create({
      name: 'Unlinked Student',
      email: 'match@example.test',
      department: 'CSE',
      semester: 4,
    });
    const account = await accounts.create({
      name: 'Unlinked Student',
      email: 'match@example.test',
      passwordHash: 'unused',
      role: 'student',
    });
    await enrollments.create({
      studentId: student.id,
      courseId: course.id,
      status: 'approved',
    });
    const published = await service.create(
      {
        courseId: course.id,
        title: 'Published quiz',
        description: 'Visible assessment',
        durationMinutes: 30,
        maxMarks: 20,
        maxAttempts: 1,
      },
      faculty,
    );
    await quizzes.createQuestion(published.id, {
      questionType: 'multiple_choice',
      questionText: 'What is 2 + 2?',
      optionA: '3',
      optionB: '4',
      optionC: '5',
      optionD: '6',
      correctOption: 'B',
      marks: 20,
    });
    await service.publish(published.id, faculty);

    const listed = await service.getAllByCourseId(course.id, {
      sub: account.id,
      role: 'student',
    });
    expect(listed.map((quiz) => quiz.id)).toEqual([published.id]);
    expect(await students.findByUserId(account.id)).toMatchObject({
      id: student.id,
    });
  });

  it('lists newly published quizzes across approved enrollments', async () => {
    const { service, course, faculty, studentUser, published, draft } =
      await setup();
    await expect(
      service.listPublishedForStudent(studentUser),
    ).resolves.toEqual([
      expect.objectContaining({ id: published.id, status: 'published' }),
    ]);
    expect(
      (await service.listPublishedForStudent(studentUser)).map(
        (quiz) => quiz.id,
      ),
    ).not.toContain(draft.id);

    const extra = await service.create(
      {
        courseId: course.id,
        title: 'Second published quiz',
        description: 'Appears after publish',
        durationMinutes: 15,
        maxMarks: 10,
        maxAttempts: 1,
      },
      faculty,
    );
    await service.createQuestion(
      extra.id,
      {
        questionType: 'multiple_choice',
        questionText: 'What is 3 + 3?',
        optionA: '5',
        optionB: '6',
        optionC: '7',
        optionD: '8',
        correctOption: 'B',
        marks: 10,
      },
      faculty,
    );
    await service.publish(extra.id, faculty);

    const listed = await service.listPublishedForStudent(studentUser);
    expect(listed.map((quiz) => quiz.id).sort()).toEqual(
      [published.id, extra.id].sort(),
    );
    expect(listed.every((quiz) => quiz.status === 'published')).toBe(true);
  });

  it('hides published quizzes from students without approved enrollment', async () => {
    const { service, course, enrollments, students, published } = await setup();
    const pendingUser = { sub: 'user-pending', role: 'student' as const };
    const pendingStudent = await students.create({
      name: 'Pending Student',
      email: 'pending@example.test',
      department: 'CSE',
      semester: 4,
    });
    await students.linkUser(pendingStudent.id, pendingUser.sub);
    await enrollments.create({
      studentId: pendingStudent.id,
      courseId: course.id,
      status: 'pending',
    });

    const listed = await service.listPublishedForStudent(pendingUser);
    expect(listed.map((quiz) => quiz.id)).not.toContain(published.id);
    expect(listed).toEqual([]);
  });

  it('hides published quizzes from students enrolled in a different course', async () => {
    const { service, courses, enrollments, students, faculty, published } =
      await setup();
    const otherCourse = await courses.create(
      { title: 'Databases', code: 'CS403', credits: 3 },
      faculty.sub,
    );
    await courses.approvePending(otherCourse.id, 'admin-1');
    const otherUser = { sub: 'user-other-course', role: 'student' as const };
    const otherStudent = await students.create({
      name: 'Other Course Student',
      email: 'other-course@example.test',
      department: 'CSE',
      semester: 4,
    });
    await students.linkUser(otherStudent.id, otherUser.sub);
    await enrollments.create({
      studentId: otherStudent.id,
      courseId: otherCourse.id,
      status: 'approved',
    });

    const listed = await service.listPublishedForStudent(otherUser);
    expect(listed.map((quiz) => quiz.id)).not.toContain(published.id);
  });

  it('lets an administrator see published quizzes for a course', async () => {
    const { service, course, published } = await setup();
    const listed = await service.getAllByCourseId(course.id, {
      sub: 'admin-1',
      role: 'admin',
    });
    expect(listed.map((quiz) => quiz.id)).toContain(published.id);
  });

  it('does not list published quizzes on unapproved courses', async () => {
    const { service, courses, enrollments, students, faculty, published } =
      await setup();
    const pendingCourse = await courses.create(
      { title: 'Pending Course', code: 'CS404', credits: 3 },
      faculty.sub,
    );
    await enrollments.create({
      studentId: (await students.findByUserId('user-student-1'))!.id,
      courseId: pendingCourse.id,
      status: 'approved',
    });
    const extra = await service.create(
      {
        courseId: pendingCourse.id,
        title: 'Hidden pending-course quiz',
        description: 'Course is not approved',
        durationMinutes: 10,
        maxMarks: 5,
        maxAttempts: 1,
      },
      faculty,
    );
    await service.createQuestion(
      extra.id,
      {
        questionType: 'multiple_choice',
        questionText: 'What is 1 + 1?',
        optionA: '1',
        optionB: '2',
        optionC: '3',
        optionD: '4',
        correctOption: 'B',
        marks: 5,
      },
      faculty,
    );
    await service.publish(extra.id, faculty);

    const listed = await service.listPublishedForStudent({
      sub: 'user-student-1',
      role: 'student',
    });
    expect(listed.map((quiz) => quiz.id)).toContain(published.id);
    expect(listed.map((quiz) => quiz.id)).not.toContain(extra.id);
  });

  it('rejects faculty from the student published-quiz list', async () => {
    const { service, faculty } = await setup();
    await expect(service.listPublishedForStudent(faculty)).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  });

  it('rejects unlinked student account when listing published quizzes', async () => {
    const { service } = await setup();
    await expect(
      service.listPublishedForStudent({
        sub: 'unlinked-student-id',
        role: 'student',
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'STUDENT_NOT_LINKED',
    });
  });
});
