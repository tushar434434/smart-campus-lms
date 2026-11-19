CREATE TYPE "CourseApprovalStatus" AS ENUM ('pending', 'approved', 'rejected');

ALTER TABLE "Course"
ADD COLUMN "approvalStatus" "CourseApprovalStatus" NOT NULL DEFAULT 'approved',
ADD COLUMN "rejectionReason" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewedById" UUID;

ALTER TABLE "Course"
ALTER COLUMN "approvalStatus" SET DEFAULT 'pending';

CREATE INDEX "Course_approvalStatus_createdAt_idx"
ON "Course"("approvalStatus", "createdAt");

ALTER TABLE "Course"
ADD CONSTRAINT "Course_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;