import { ApiProperty } from '@nestjs/swagger';

/**
 * How many of the learner's words stand at each level (FR-061). The keys are the
 * levels themselves, so nothing has to translate between this and the mastery a
 * word reports elsewhere. `NEW` has no row in the database; it is every word the
 * learner has never answered.
 */
export class MasteryCountsDto {
  @ApiProperty({ description: 'Never answered.' })
  NEW: number;

  @ApiProperty()
  LEARNING: number;

  @ApiProperty()
  FAMILIAR: number;

  @ApiProperty()
  MASTERED: number;
}

/** One world's share of the learner's progress (FR-061). */
export class WorldProgressDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  wordCount: number;

  @ApiProperty()
  masteredCount: number;
}

/** Everything the progress page shows (FR-060, FR-061, US-060). */
export class ProgressDto {
  @ApiProperty({ description: 'Only ever rises, whatever is deleted (V4).' })
  totalXp: number;

  @ApiProperty({ type: MasteryCountsDto })
  words: MasteryCountsDto;

  @ApiProperty({
    description: 'Every world the learner has, newest first.',
    type: WorldProgressDto,
    isArray: true,
  })
  worlds: WorldProgressDto[];
}
