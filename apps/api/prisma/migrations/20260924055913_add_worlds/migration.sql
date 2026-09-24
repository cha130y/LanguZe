-- CreateEnum
CREATE TYPE "world_status" AS ENUM ('ANALYZING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "analysis_failure" AS ENUM ('BLOCKED', 'TOO_FEW_WORDS', 'PROVIDER_ERROR', 'INVALID_OUTPUT', 'TIMED_OUT');

-- CreateTable
CREATE TABLE "worlds" (
    "id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "status" "world_status" NOT NULL DEFAULT 'ANALYZING',
    "failure_reason" "analysis_failure",
    "photo_id" UUID,
    "thumbnail_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "worlds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "worlds_photo_id_key" ON "worlds"("photo_id");

-- CreateIndex
CREATE UNIQUE INDEX "worlds_thumbnail_id_key" ON "worlds"("thumbnail_id");

-- CreateIndex
CREATE INDEX "worlds_learner_id_created_at_idx" ON "worlds"("learner_id", "created_at");

-- AddForeignKey
ALTER TABLE "worlds" ADD CONSTRAINT "worlds_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worlds" ADD CONSTRAINT "worlds_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "stored_photos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worlds" ADD CONSTRAINT "worlds_thumbnail_id_fkey" FOREIGN KEY ("thumbnail_id") REFERENCES "stored_photos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
