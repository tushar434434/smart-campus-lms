CREATE TYPE "QuizQuestionImageSlot" AS ENUM (
  'question',
  'optionA',
  'optionB',
  'optionC',
  'optionD'
);

CREATE TABLE "QuizQuestionImage" (
  "id" UUID NOT NULL,
  "questionId" UUID NOT NULL,
  "slot" "QuizQuestionImageSlot" NOT NULL,
  "fileKey" TEXT NOT NULL,
  "fileMimeType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "originalFileName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "QuizQuestionImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuizQuestionImage_fileKey_key"
ON "QuizQuestionImage"("fileKey");
CREATE UNIQUE INDEX "QuizQuestionImage_questionId_slot_key"
ON "QuizQuestionImage"("questionId", "slot");

ALTER TABLE "QuizQuestionImage"
ADD CONSTRAINT "QuizQuestionImage_questionId_fkey"
FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id")
ON DELETE CASCADE ON UPDATE CASCADE;