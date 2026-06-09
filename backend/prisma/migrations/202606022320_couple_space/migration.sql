CREATE TABLE "CoupleBond" (
  "id" TEXT NOT NULL,
  "userAId" TEXT NOT NULL,
  "userBId" TEXT NOT NULL,
  "requestedBy" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "boundAt" TIMESTAMP(3),
  "lockedUntil" TIMESTAMP(3),
  "metAt" TIMESTAMP(3),
  "loveAt" TIMESTAMP(3),
  "countdownTitle" TEXT NOT NULL DEFAULT '',
  "countdownAt" TIMESTAMP(3),
  "userACity" TEXT NOT NULL DEFAULT '',
  "userALat" DOUBLE PRECISION,
  "userALon" DOUBLE PRECISION,
  "userBCity" TEXT NOT NULL DEFAULT '',
  "userBLat" DOUBLE PRECISION,
  "userBLon" DOUBLE PRECISION,
  "lastSosAt" TIMESTAMP(3),
  "lastSosBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CoupleBond_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CoupleBond_userAId_userBId_key" ON "CoupleBond"("userAId", "userBId");
CREATE INDEX "CoupleBond_userAId_idx" ON "CoupleBond"("userAId");
CREATE INDEX "CoupleBond_userBId_idx" ON "CoupleBond"("userBId");
