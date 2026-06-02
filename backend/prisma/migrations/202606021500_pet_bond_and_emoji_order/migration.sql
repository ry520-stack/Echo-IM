ALTER TABLE "Emoji" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "PetBond" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "name" TEXT NOT NULL DEFAULT 'Echo',
    "avatar" TEXT NOT NULL DEFAULT '',
    "level" INTEGER NOT NULL DEFAULT 1,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "intimacy" INTEGER NOT NULL DEFAULT 0,
    "lastSpokeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PetBond_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PetBond_userAId_userBId_key" ON "PetBond"("userAId", "userBId");
CREATE INDEX "PetBond_userAId_idx" ON "PetBond"("userAId");
CREATE INDEX "PetBond_userBId_idx" ON "PetBond"("userBId");

