CREATE TABLE "QuizBookmark" (
  "id" UUID NOT NULL,
  "attemptId" UUID NOT NULL,
  "questionId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "QuizBookmark_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuizBookmark_attemptId_questionId_key"
ON "QuizBookmark"("attemptId", "questionId");
CREATE INDEX "QuizBookmark_attemptId_idx" ON "QuizBookmark"("attemptId");

ALTER TABLE "QuizBookmark"
ADD CONSTRAINT "QuizBookmark_attemptId_fkey"
FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuizBookmark"
ADD CONSTRAINT "QuizBookmark_questionId_fkey"
FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id")
ON DELETE CASCADE ON UPDATE CASCADE;