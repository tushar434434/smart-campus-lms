CREATE TYPE "QuizQuestionType" AS ENUM ('multiple_choice', 'true_false');

ALTER TABLE "QuizQuestion"
ADD COLUMN "questionType" "QuizQuestionType" NOT NULL DEFAULT 'multiple_choice';