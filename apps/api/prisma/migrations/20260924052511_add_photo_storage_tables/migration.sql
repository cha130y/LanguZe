-- CreateEnum
CREATE TYPE "photo_kind" AS ENUM ('PREPARED', 'THUMBNAIL');

-- CreateEnum
CREATE TYPE "photo_deletion_reason" AS ENUM ('WORLD_DELETED', 'ACCOUNT_DELETED', 'PHOTO_BLOCKED', 'UPLOAD_FAILED');

-- CreateTable
CREATE TABLE "stored_photos" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "storage_key" VARCHAR(200) NOT NULL,
    "kind" "photo_kind" NOT NULL,
    "content_type" VARCHAR(50) NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_deletions" (
    "id" UUID NOT NULL,
    "storage_key" VARCHAR(200) NOT NULL,
    "reason" "photo_deletion_reason" NOT NULL,
    "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" VARCHAR(500),

    CONSTRAINT "photo_deletions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stored_photos_storage_key_key" ON "stored_photos"("storage_key");

-- CreateIndex
CREATE INDEX "stored_photos_owner_id_idx" ON "stored_photos"("owner_id");

-- CreateIndex
CREATE INDEX "photo_deletions_next_attempt_at_idx" ON "photo_deletions"("next_attempt_at");

-- AddForeignKey
ALTER TABLE "stored_photos" ADD CONSTRAINT "stored_photos_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
