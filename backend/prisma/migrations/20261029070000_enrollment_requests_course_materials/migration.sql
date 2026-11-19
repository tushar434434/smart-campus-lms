CREATE TYPE "EnrollmentStatus" AS ENUM ('pending', 'approved', 'rejected');

ALTER TABLE "Enrollment"
ADD COLUMN "status" "EnrollmentStatus" NOT NULL DEFAULT 'approved',
ADD COLUMN "rejectionReason" TEXT,
ADD COLUMN "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewedById" UUID;

ALTER TABLE "Enrollment"
ALTER COLUMN "status" SET DEFAULT 'pending';

CREATE INDEX "Enrollment_courseId_status_requestedAt_idx"
ON "Enrollment"("courseId", "status", "requestedAt");

ALTER TABLE "Enrollment"
ADD CONSTRAINT "Enrollment_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TYPE "CourseMaterialType" AS ENUM (
  'notes',
  'pyq',
  'syllabus',
  'lecture_slides',
  'reference'
);

CREATE TABLE "CourseMaterial" (
  "id" UUID NOT NULL,
  "courseId" UUID NOT NULL,
  "uploadedById" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "unitNumber" INTEGER,
  "type" "CourseMaterialType" NOT NULL,
  "originalFileName" TEXT NOT NULL,
  "fileKey" TEXT NOT NULL,
  "fileMimeType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CourseMaterial_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourseMaterial_fileKey_key" ON "CourseMaterial"("fileKey");
CREATE INDEX "CourseMaterial_courseId_type_unitNumber_createdAt_idx"
ON "CourseMaterial"("courseId", "type", "unitNumber", "createdAt");

ALTER TABLE "CourseMaterial"
ADD CONSTRAINT "CourseMaterial_courseId_fkey"
FOREIGN KEY ("courseId") REFERENCES "Course"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourseMaterial"
ADD CONSTRAINT "CourseMaterial_uploadedById_fkey"
FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;