-- CreateTable
CREATE TABLE "QuestionBankDirection" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuestionBankDirection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionBankTemplateBlock" (
    "id" TEXT NOT NULL,
    "directionId" TEXT NOT NULL,
    "sourceKey" TEXT,
    "title" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuestionBankTemplateBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionBankTemplateQuestion" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "responseType" TEXT NOT NULL DEFAULT 'text',
    "contributedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionBankTemplateQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuestionBankDirection_slug_key" ON "QuestionBankDirection"("slug");

-- CreateIndex
CREATE INDEX "QuestionBankTemplateBlock_directionId_idx" ON "QuestionBankTemplateBlock"("directionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionBankTemplateBlock_directionId_sourceKey_key" ON "QuestionBankTemplateBlock"("directionId", "sourceKey");

-- CreateIndex
CREATE INDEX "QuestionBankTemplateQuestion_blockId_idx" ON "QuestionBankTemplateQuestion"("blockId");

-- AddForeignKey
ALTER TABLE "QuestionBankTemplateBlock" ADD CONSTRAINT "QuestionBankTemplateBlock_directionId_fkey" FOREIGN KEY ("directionId") REFERENCES "QuestionBankDirection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionBankTemplateQuestion" ADD CONSTRAINT "QuestionBankTemplateQuestion_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "QuestionBankTemplateBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionBankTemplateQuestion" ADD CONSTRAINT "QuestionBankTemplateQuestion_contributedByUserId_fkey" FOREIGN KEY ("contributedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
