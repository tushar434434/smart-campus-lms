import { AppError } from '../../errors/app-error.js';
import type { CourseRepository } from './course.repository.interface.js';
import type { EnrollmentRepository } from '../enrollments/enrollment.repository.interface.js';
import type { StudentRepository } from '../students/student.repository.interface.js';
import type { CourseMaterialRepository } from './course-material.repository.interface.js';
import type { CourseMaterial } from './course-material.repository.js';
import type { CreateCourseMaterialInput } from './course-material.schema.js';
import {
  MAX_COURSE_MATERIAL_SIZE,
  validateCourseMaterialFile,
  type CourseMaterialFileStorage,
} from './course-material-file-storage.js';

type MaterialUser = { sub: string; role: 'student' | 'faculty' | 'admin' };
type PublicCourseMaterial = Omit<CourseMaterial, 'fileKey' | 'uploadedById'>;

function publicMaterial(material: CourseMaterial): PublicCourseMaterial {
  const { fileKey, uploadedById, ...visible } = material;
  void fileKey;
  void uploadedById;
  return visible;
}

export function createCourseMaterialService(
  repository: CourseMaterialRepository,
  storage: CourseMaterialFileStorage,
  courseRepository: CourseRepository,
  enrollmentRepository: EnrollmentRepository,
  studentRepository: StudentRepository,
) {
  async function requireCourseAccess(courseId: string, user: MaterialUser) {
    const course = await courseRepository.findById(courseId);
    if (!course || course.approvalStatus !== 'approved') {
      throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
    }
    if (user.role === 'admin') return course;
    if (user.role === 'faculty') {
      if (course.ownerFacultyId !== user.sub) {
        throw new AppError('Course access denied', 403, 'FORBIDDEN');
      }
      return course;
    }

    const student = await studentRepository.findByUserId(user.sub);
    if (!student) {
      throw new AppError(
        'Student account is not linked',
        403,
        'STUDENT_NOT_LINKED',
      );
    }
    const enrollment = await enrollmentRepository.findByStudentAndCourse(
      student.id,
      courseId,
    );
    if (!enrollment || enrollment.status !== 'approved') {
      throw new AppError(
        'Approved enrollment is required',
        403,
        'NOT_ENROLLED',
      );
    }
    return course;
  }

  async function requireManager(courseId: string, user: MaterialUser) {
    if (user.role === 'student') {
      throw new AppError('Course staff access is required', 403, 'FORBIDDEN');
    }
    return requireCourseAccess(courseId, user);
  }

  return {
    async create(
      courseId: string,
      input: CreateCourseMaterialInput,
      file: { buffer: Buffer; mimeType: string; originalFileName: string },
      user: MaterialUser,
    ): Promise<PublicCourseMaterial> {
      await requireManager(courseId, user);
      let mimeType;
      try {
        mimeType = validateCourseMaterialFile(file.buffer, file.mimeType);
      } catch (error) {
        const code = error instanceof Error ? error.message : '';
        if (code === 'MATERIAL_FILE_TOO_LARGE') {
          throw new AppError(
            'Material files cannot exceed 10 MiB',
            413,
            'FILE_TOO_LARGE',
          );
        }
        if (code === 'MATERIAL_FILE_EMPTY') {
          throw new AppError('Material file is empty', 400, 'FILE_EMPTY');
        }
        throw new AppError(
          'Use a valid PDF, image, text, DOC/DOCX, PPT/PPTX, or XLS/XLSX file',
          400,
          'INVALID_FILE_TYPE',
        );
      }

      const fileKey = await storage.save(file.buffer, mimeType);
      try {
        return publicMaterial(
          await repository.create({
            courseId,
            uploadedById: user.sub,
            title: input.title,
            description: input.description ?? null,
            unitNumber: input.unitNumber ?? null,
            type: input.type,
            originalFileName: file.originalFileName.slice(0, 255),
            fileKey,
            fileMimeType: mimeType,
            fileSize: file.buffer.byteLength,
          }),
        );
      } catch (error) {
        await storage.remove(fileKey);
        throw error;
      }
    },

    async list(courseId: string, user: MaterialUser) {
      await requireCourseAccess(courseId, user);
      return (await repository.findByCourseId(courseId)).map(publicMaterial);
    },

    async readFile(id: string, user: MaterialUser) {
      const material = await repository.findById(id);
      if (!material) {
        throw new AppError(
          'Course material not found',
          404,
          'MATERIAL_NOT_FOUND',
        );
      }
      await requireCourseAccess(material.courseId, user);
      return {
        buffer: await storage.read(material.fileKey),
        mimeType: material.fileMimeType,
        fileName: material.originalFileName,
        size: material.fileSize,
      };
    },

    async delete(id: string, user: MaterialUser): Promise<void> {
      const material = await repository.findById(id);
      if (!material) {
        throw new AppError(
          'Course material not found',
          404,
          'MATERIAL_NOT_FOUND',
        );
      }
      await requireManager(material.courseId, user);
      if (!(await repository.delete(id))) {
        throw new AppError(
          'Course material not found',
          404,
          'MATERIAL_NOT_FOUND',
        );
      }
      await storage.remove(material.fileKey);
    },
  };
}

export { MAX_COURSE_MATERIAL_SIZE };
