ALTER TABLE "Assignment"
ADD COLUMN "fileKey" TEXT,
ADD COLUMN "fileMimeType" TEXT,
ADD COLUMN "fileSize" INTEGER,
ADD COLUMN "originalFileName" TEXT;

CREATE UNIQUE INDEX "Assignment_fileKey_key" ON "Assignment"("fileKey");