-- AlterTable
ALTER TABLE "Vacancy" ADD COLUMN "hiredCandidateId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Vacancy_hiredCandidateId_key" ON "Vacancy"("hiredCandidateId");

-- AddForeignKey
ALTER TABLE "Vacancy" ADD CONSTRAINT "Vacancy_hiredCandidateId_fkey" FOREIGN KEY ("hiredCandidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
