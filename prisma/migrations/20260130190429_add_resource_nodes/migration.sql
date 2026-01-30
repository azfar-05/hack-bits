-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('BOAT', 'GENERATOR', 'WATER', 'FOOD', 'MEDICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "CreatorType" AS ENUM ('VOLUNTEER', 'BUSINESS', 'AUTHORITY');

-- AlterTable
ALTER TABLE "RescueRequest" ADD COLUMN     "etaConfidence" TEXT,
ADD COLUMN     "etaFactors" TEXT,
ADD COLUMN     "etaMaxMinutes" INTEGER,
ADD COLUMN     "etaMinMinutes" INTEGER;

-- CreateTable
CREATE TABLE "ResourceNode" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "createdBy" "CreatorType" NOT NULL,
    "contactInfo" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceNode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResourceNode_latitude_longitude_idx" ON "ResourceNode"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "ResourceNode_resourceType_idx" ON "ResourceNode"("resourceType");

-- AddForeignKey
ALTER TABLE "ResourceNode" ADD CONSTRAINT "ResourceNode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
