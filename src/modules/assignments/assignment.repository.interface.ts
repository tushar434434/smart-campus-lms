export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  description: string;
  dueAt: string;
  maxMarks: number;
  createdAt: string;
}

export interface AssignmentRepository {
  create(input: Omit<Assignment, 'id' | 'createdAt'>): Assignment;

  findAllByCourseId(courseId: string): Assignment[];

  findById(id: string): Assignment | undefined;

  update(
    id: string,
    input: Partial<Omit<Assignment, 'id' | 'courseId' | 'createdAt'>>,
  ): Assignment | undefined;

  delete(id: string): boolean;
}
