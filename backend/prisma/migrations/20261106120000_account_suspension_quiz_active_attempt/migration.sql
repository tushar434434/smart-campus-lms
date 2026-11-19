ALTER TABLE "User" ADD COLUMN "suspendedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "QuizAttempt_one_in_progress_per_student"
ON "QuizAttempt" ("quizId", "studentId")
WHERE "status" = 'in_progress';
