-- CreateEnum
CREATE TYPE "tutor_role" AS ENUM ('LEARNER', 'TUTOR');

-- CreateTable
CREATE TABLE "tutor_messages" (
    "id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "role" "tutor_role" NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutor_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutor_daily_usage" (
    "learner_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "messages_used" SMALLINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tutor_daily_usage_pkey" PRIMARY KEY ("learner_id","day")
);

-- CreateIndex
CREATE INDEX "tutor_messages_learner_id_created_at_idx" ON "tutor_messages"("learner_id", "created_at");

-- AddForeignKey
ALTER TABLE "tutor_messages" ADD CONSTRAINT "tutor_messages_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_daily_usage" ADD CONSTRAINT "tutor_daily_usage_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A learner's message is at most 1,000 characters (V7, FR-071). A reply is not
-- capped, because the tutor decides how much an explanation needs. The API checks
-- the same rule at the boundary; this keeps it true whatever writes the row.
ALTER TABLE "tutor_messages"
  ADD CONSTRAINT "tutor_messages_learner_message_length" CHECK (
    length("content") > 0
    AND ("role" <> 'LEARNER' OR length("content") <= 1000)
  );

-- Messages are reserved before the provider is called and given back if it fails
-- (S6), so the count moves both ways and must never pass zero going down.
ALTER TABLE "tutor_daily_usage"
  ADD CONSTRAINT "tutor_daily_usage_not_negative" CHECK ("messages_used" >= 0);
