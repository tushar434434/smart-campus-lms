export interface Enrollment {
  id: string;
  studentId: string;
  courseId: string;
  enrolledAt: string;
}

export interface EnrollmentRepository {
  create(input: { studentId: string; courseId: string }): Enrollment;

  findById(id: string): Enrollment | undefined;

  findByStudentId(studentId: string): Enrollment[];

  findByStudentAndCourse(
    studentId: string,
    courseId: string,
  ): Enrollment | undefined;

  delete(id: string): boolean;
}
