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
      accounts,
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
});
