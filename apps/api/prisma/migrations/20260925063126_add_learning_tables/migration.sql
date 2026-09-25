-- CreateEnum
CREATE TYPE "mastery_level" AS ENUM ('LEARNING', 'FAMILIAR', 'MASTERED');

-- CreateEnum
CREATE TYPE "session_kind" AS ENUM ('GAME', 'REVIEW');

-- CreateEnum
CREATE TYPE "session_status" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateTable
CREATE TABLE "word_mastery" (
    "vocabulary_word_id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "level" "mastery_level" NOT NULL,
    "streak" SMALLINT NOT NULL DEFAULT 0,
    "familiar_on" DATE,
    "last_practised_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "word_mastery_pkey" PRIMARY KEY ("vocabulary_word_id")
);

-- CreateTable
CREATE TABLE "practice_sessions" (
    "id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "kind" "session_kind" NOT NULL,
    "world_id" UUID,
    "status" "session_status" NOT NULL DEFAULT 'IN_PROGRESS',
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "practice_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_questions" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "vocabulary_word_id" UUID,
    "occurrence_id" UUID,

    CONSTRAINT "session_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempts" (
    "id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "vocabulary_word_id" UUID NOT NULL,
    "question_id" UUID,
    "session_id" UUID,
    "occurrence_id" UUID,
    "answer_text" VARCHAR(100),
    "is_dont_know" BOOLEAN NOT NULL DEFAULT false,
    "is_correct" BOOLEAN NOT NULL,
    "xp_awarded" SMALLINT NOT NULL DEFAULT 0,
    "answered_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learner_xp" (
    "learner_id" UUID NOT NULL,
    "total_xp" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "learner_xp_pkey" PRIMARY KEY ("learner_id")
);

-- CreateIndex
CREATE INDEX "word_mastery_learner_id_level_idx" ON "word_mastery"("learner_id", "level");

-- CreateIndex
CREATE INDEX "practice_sessions_learner_id_started_at_idx" ON "practice_sessions"("learner_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "session_questions_session_id_position_key" ON "session_questions"("session_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "attempts_question_id_key" ON "attempts"("question_id");

-- CreateIndex
CREATE INDEX "attempts_learner_id_answered_at_idx" ON "attempts"("learner_id", "answered_at");

-- CreateIndex
CREATE INDEX "attempts_vocabulary_word_id_answered_at_idx" ON "attempts"("vocabulary_word_id", "answered_at");

-- AddForeignKey
ALTER TABLE "word_mastery" ADD CONSTRAINT "word_mastery_vocabulary_word_id_fkey" FOREIGN KEY ("vocabulary_word_id") REFERENCES "vocabulary_words"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "word_mastery" ADD CONSTRAINT "word_mastery_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_questions" ADD CONSTRAINT "session_questions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "practice_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_questions" ADD CONSTRAINT "session_questions_vocabulary_word_id_fkey" FOREIGN KEY ("vocabulary_word_id") REFERENCES "vocabulary_words"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_questions" ADD CONSTRAINT "session_questions_occurrence_id_fkey" FOREIGN KEY ("occurrence_id") REFERENCES "word_occurrences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_vocabulary_word_id_fkey" FOREIGN KEY ("vocabulary_word_id") REFERENCES "vocabulary_words"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "session_questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "practice_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_occurrence_id_fkey" FOREIGN KEY ("occurrence_id") REFERENCES "word_occurrences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_xp" ADD CONSTRAINT "learner_xp_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A learner has at most one unfinished game per world and one unfinished review
-- (FR-036). Starting a new session abandons the old one in the same transaction;
-- these indexes are what make two sessions impossible if two requests race.
-- A game whose world was deleted keeps a null world_id, and Postgres treats nulls
-- as distinct here, which is right: those sessions constrain nothing any more.
CREATE UNIQUE INDEX "practice_sessions_one_open_game"
  ON "practice_sessions" ("learner_id", "world_id")
  WHERE "status" = 'IN_PROGRESS' AND "kind" = 'GAME';

CREATE UNIQUE INDEX "practice_sessions_one_open_review"
  ON "practice_sessions" ("learner_id")
  WHERE "status" = 'IN_PROGRESS' AND "kind" = 'REVIEW';

-- "I don't know" is an incorrect attempt with nothing typed (FR-032). Without this
-- a bug could record it as correct, award XP, and keep a mistake with invented text.
ALTER TABLE "attempts"
  ADD CONSTRAINT "attempts_dont_know_is_blank_and_wrong" CHECK (
    NOT "is_dont_know" OR ("answer_text" IS NULL AND NOT "is_correct")
  );

-- An incorrect answer earns nothing, and nothing ever takes XP away (FR-033, V4).
ALTER TABLE "attempts"
  ADD CONSTRAINT "attempts_wrong_answers_earn_nothing" CHECK (
    "xp_awarded" >= 0 AND ("is_correct" OR "xp_awarded" = 0)
  );

-- Positions start at 1, because the learner is shown "question 1 of 10".
ALTER TABLE "session_questions"
  ADD CONSTRAINT "session_questions_position_starts_at_one" CHECK ("position" >= 1);

-- A streak counts correct answers, so it cannot go below none (SRS 4.1).
ALTER TABLE "word_mastery"
  ADD CONSTRAINT "word_mastery_streak_not_negative" CHECK ("streak" >= 0);

-- Total XP only ever rises (FR-060, V4).
ALTER TABLE "learner_xp"
  ADD CONSTRAINT "learner_xp_not_negative" CHECK ("total_xp" >= 0);
