/**
 * How far the learner has got with a word, in their own words (SRS 4.1). One map,
 * because a word's level is reported in four places — the list of a world's words,
 * the feedback after an answer, the end of a session, and the progress page — and
 * a level that reads differently in each would look like four different things.
 *
 * `NEW` has no row in the database; it is a word nobody has answered yet.
 */
export const MASTERY_TEXT: Record<string, string> = {
  NEW: 'ยังไม่ได้ฝึก',
  LEARNING: 'กำลังเรียน',
  FAMILIAR: 'เริ่มคุ้น',
  MASTERED: 'จำได้แล้ว',
};

/** The order a learner climbs, which is the order the progress page lists them. */
export const MASTERY_LEVELS = [
  'NEW',
  'LEARNING',
  'FAMILIAR',
  'MASTERED',
] as const;

export const masteryText = (level: string): string =>
  MASTERY_TEXT[level] ?? level;
