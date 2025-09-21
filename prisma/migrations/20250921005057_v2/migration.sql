-- AlterTable
ALTER TABLE "public"."Board" ADD COLUMN     "ownerId" TEXT;

-- CreateIndex
CREATE INDEX "Board_ownerId_idx" ON "public"."Board"("ownerId");

-- CreateIndex
CREATE INDEX "Edge_boardId_idx" ON "public"."Edge"("boardId");

-- CreateIndex
CREATE INDEX "Edge_sourceId_idx" ON "public"."Edge"("sourceId");

-- CreateIndex
CREATE INDEX "Edge_targetId_idx" ON "public"."Edge"("targetId");

-- CreateIndex
CREATE INDEX "Node_boardId_idx" ON "public"."Node"("boardId");

-- CreateIndex
CREATE INDEX "Node_parentId_idx" ON "public"."Node"("parentId");

-- CreateIndex
CREATE INDEX "Node_rootId_idx" ON "public"."Node"("rootId");

-- AddForeignKey
ALTER TABLE "public"."Node" ADD CONSTRAINT "Node_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."Node"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Node" ADD CONSTRAINT "Node_rootId_fkey" FOREIGN KEY ("rootId") REFERENCES "public"."Node"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Edge" ADD CONSTRAINT "Edge_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "public"."Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Edge" ADD CONSTRAINT "Edge_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "public"."Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;
