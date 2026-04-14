-- AlterTable
ALTER TABLE "BlockScore" ADD COLUMN "overallScore" INTEGER NOT NULL DEFAULT 3;

-- Исторические строки: общая оценка = прежнему рассчитанному баллу по рубрике
UPDATE "BlockScore" SET "overallScore" = "score";
