-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vacancy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "competencies" TEXT NOT NULL,
    "expectationsForCandidate" TEXT NOT NULL DEFAULT '',
    "recruiterInternalNote" TEXT NOT NULL DEFAULT '',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "status" TEXT NOT NULL DEFAULT 'active',
    "targetCloseDate" TIMESTAMP(3),
    "workFormat" TEXT NOT NULL DEFAULT '',
    "planUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vacancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanBlock" (
    "id" TEXT NOT NULL,
    "vacancyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PlanBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanQuestion" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "responseType" TEXT NOT NULL DEFAULT 'text',

    CONSTRAINT "PlanQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "vacancyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summaryJson" TEXT,
    "risksJson" TEXT,
    "discrepanciesJson" TEXT,
    "summaryUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interviewer" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inviteToken" TEXT NOT NULL,

    CONSTRAINT "Interviewer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Protocol" (
    "id" TEXT NOT NULL,
    "interviewerId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "Protocol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionAnswer" (
    "id" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "planQuestionId" TEXT NOT NULL,
    "textAnswer" TEXT NOT NULL DEFAULT '',
    "scoreAnswer" INTEGER,

    CONSTRAINT "QuestionAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockScore" (
    "id" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "planBlockId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "BlockScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Interviewer_inviteToken_key" ON "Interviewer"("inviteToken");

-- CreateIndex
CREATE UNIQUE INDEX "Protocol_interviewerId_key" ON "Protocol"("interviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionAnswer_protocolId_planQuestionId_key" ON "QuestionAnswer"("protocolId", "planQuestionId");

-- CreateIndex
CREATE UNIQUE INDEX "BlockScore_protocolId_planBlockId_key" ON "BlockScore"("protocolId", "planBlockId");

-- AddForeignKey
ALTER TABLE "Vacancy" ADD CONSTRAINT "Vacancy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanBlock" ADD CONSTRAINT "PlanBlock_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "Vacancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanQuestion" ADD CONSTRAINT "PlanQuestion_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "PlanBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "Vacancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interviewer" ADD CONSTRAINT "Interviewer_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Protocol" ADD CONSTRAINT "Protocol_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "Interviewer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAnswer" ADD CONSTRAINT "QuestionAnswer_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "Protocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAnswer" ADD CONSTRAINT "QuestionAnswer_planQuestionId_fkey" FOREIGN KEY ("planQuestionId") REFERENCES "PlanQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockScore" ADD CONSTRAINT "BlockScore_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "Protocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockScore" ADD CONSTRAINT "BlockScore_planBlockId_fkey" FOREIGN KEY ("planBlockId") REFERENCES "PlanBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
