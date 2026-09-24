-- CreateEnum
CREATE TYPE "analysis_status" AS ENUM ('IN_PROGRESS', 'SUCCEEDED', 'BLOCKED', 'FAILED');

-- CreateEnum
CREATE TYPE "cefr_level" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');

-- CreateEnum
CREATE TYPE "block_category" AS ENUM ('SEXUAL_CONTENT', 'SUSPECTED_ILLEGAL_MATERIAL', 'VIOLENCE', 'ILLEGAL_ACTIVITY', 'HATE_SYMBOL', 'PERSONAL_DATA', 'OTHER');

-- CreateEnum
CREATE TYPE "ai_purpose" AS ENUM ('SAFETY_CHECK', 'EXTRACTION', 'TUTOR');

-- CreateEnum
CREATE TYPE "ai_outcome" AS ENUM ('SUCCEEDED', 'FAILED', 'TIMED_OUT', 'INVALID_OUTPUT');

-- CreateTable
CREATE TABLE "analyses" (
    "id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "world_id" UUID,
    "status" "analysis_status" NOT NULL DEFAULT 'IN_PROGRESS',
    "failure_reason" "analysis_failure",
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),

    CONSTRAINT "analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabulary_words" (
    "id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "english" VARCHAR(40) NOT NULL,
    "thai_meaning" VARCHAR(100) NOT NULL,
    "thai_meaning_key" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vocabulary_words_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "word_occurrences" (
    "id" UUID NOT NULL,
    "world_id" UUID NOT NULL,
    "vocabulary_word_id" UUID NOT NULL,
    "box_x" DOUBLE PRECISION NOT NULL,
    "box_y" DOUBLE PRECISION NOT NULL,
    "box_width" DOUBLE PRECISION NOT NULL,
    "box_height" DOUBLE PRECISION NOT NULL,
    "example_sentence" VARCHAR(200) NOT NULL,
    "cefr_level" "cefr_level" NOT NULL,
    "accepted_variants" VARCHAR(40)[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "word_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_blocks" (
    "id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "category" "block_category" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_calls" (
    "id" UUID NOT NULL,
    "purpose" "ai_purpose" NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latency_ms" INTEGER NOT NULL,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "outcome" "ai_outcome" NOT NULL,
    "error_code" VARCHAR(100),
    "request_id" VARCHAR(100),

    CONSTRAINT "ai_calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analyses_learner_id_started_at_idx" ON "analyses"("learner_id", "started_at");

-- CreateIndex
CREATE INDEX "analyses_status_started_at_idx" ON "analyses"("status", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "vocabulary_words_learner_id_english_thai_meaning_key_key" ON "vocabulary_words"("learner_id", "english", "thai_meaning_key");

-- CreateIndex
CREATE INDEX "word_occurrences_vocabulary_word_id_idx" ON "word_occurrences"("vocabulary_word_id");

-- CreateIndex
CREATE UNIQUE INDEX "word_occurrences_world_id_vocabulary_word_id_key" ON "word_occurrences"("world_id", "vocabulary_word_id");

-- CreateIndex
CREATE INDEX "photo_blocks_learner_id_created_at_idx" ON "photo_blocks"("learner_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_calls_started_at_idx" ON "ai_calls"("started_at");

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabulary_words" ADD CONSTRAINT "vocabulary_words_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "word_occurrences" ADD CONSTRAINT "word_occurrences_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "word_occurrences" ADD CONSTRAINT "word_occurrences_vocabulary_word_id_fkey" FOREIGN KEY ("vocabulary_word_id") REFERENCES "vocabulary_words"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_blocks" ADD CONSTRAINT "photo_blocks_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
