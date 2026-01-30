-- CreateEnum
CREATE TYPE "SafeZoneType" AS ENUM ('SHELTER', 'CAMP', 'HOSPITAL');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "SafeZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SafeZoneType" NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "capacity" INTEGER,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafeZone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SafeZone_latitude_longitude_idx" ON "SafeZone"("latitude", "longitude");

-- AddForeignKey
ALTER TABLE "SafeZone" ADD CONSTRAINT "SafeZone_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
