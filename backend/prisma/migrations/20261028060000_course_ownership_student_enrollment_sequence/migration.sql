ALTER TABLE "Course"
ADD COLUMN "ownerFacultyId" UUID;

CREATE INDEX "Course_ownerFacultyId_idx" ON "Course"("ownerFacultyId");

ALTER TABLE "Course"
ADD CONSTRAINT "Course_ownerFacultyId_fkey"
FOREIGN KEY ("ownerFacultyId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "StudentEnrollmentSequence" (
    "year" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,
    CONSTRAINT "StudentEnrollmentSequence_pkey" PRIMARY KEY ("year")
);
