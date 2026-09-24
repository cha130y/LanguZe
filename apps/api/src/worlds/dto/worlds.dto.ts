import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import type {
  AnalysisFailure,
  WorldStatus,
} from '../../generated/prisma/enums.js';

/** 1–50 characters, the same rule wherever a world is named (V3, FR-010, FR-016). */
const NAME_RULE = { minLength: 1, maxLength: 50 };

export class CreateWorldDto {
  @ApiProperty({
    ...NAME_RULE,
    description: 'What the learner calls this place.',
  })
  @IsString()
  @Length(1, 50)
  name: string;
}

export class RenameWorldDto {
  @ApiProperty(NAME_RULE)
  @IsString()
  @Length(1, 50)
  name: string;
}

/** One world in the list (FR-013). */
export class WorldSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: ['ANALYZING', 'READY', 'FAILED'] })
  status: WorldStatus;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Why the analysis failed, when it did.',
  })
  failureReason: AnalysisFailure | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'A signed link to the thumbnail, valid for a few minutes (P4). Empty when the photo is gone.',
  })
  thumbnailUrl: string | null;

  @ApiProperty({ description: 'Words found in this world (FR-013).' })
  wordCount: number;

  @ApiProperty({ description: 'Of those, the ones the learner has mastered.' })
  masteredCount: number;

  @ApiProperty()
  createdAt: string;
}

/** A highlight box on the prepared photo, in 0–1 coordinates (AIR-003). */
export class HighlightBoxDto {
  @ApiProperty()
  x: number;

  @ApiProperty()
  y: number;

  @ApiProperty()
  width: number;

  @ApiProperty()
  height: number;
}

/** One word found in this world's photo (FR-014, FR-022). */
export class WorldWordDto {
  @ApiProperty({ description: 'Identifies this word in this world (FR-026).' })
  id: string;

  @ApiProperty()
  english: string;

  @ApiProperty()
  thaiMeaning: string;

  @ApiProperty()
  exampleSentence: string;

  @ApiProperty({ enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] })
  cefrLevel: string;

  @ApiProperty({ type: HighlightBoxDto })
  box: HighlightBoxDto;

  @ApiProperty({
    description: 'What the learner has to do with this word to master it.',
    enum: ['NEW', 'LEARNING', 'FAMILIAR', 'MASTERED'],
  })
  mastery: string;
}

/** One world with its photo and words (FR-014). */
export class WorldDetailDto extends WorldSummaryDto {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'A signed link to the prepared photo (P4).',
  })
  photoUrl: string | null;

  @ApiProperty({ type: WorldWordDto, isArray: true })
  words: WorldWordDto[];
}

/** What is left of today's limits (FR-080, US-080). */
export class UsageResponseDto {
  @ApiProperty({ description: 'Photo analyses left today.' })
  analysesLeft: number;

  @ApiProperty({ description: 'How many a learner gets each day.' })
  analysesLimit: number;

  @ApiProperty({ description: 'When the count starts again, in Bangkok time.' })
  resetsAt: string;
}

/** Just the status, for the page that waits for an analysis (FR-021, P3). */
export class WorldStatusDto {
  @ApiProperty({ enum: ['ANALYZING', 'READY', 'FAILED'] })
  status: WorldStatus;

  @ApiPropertyOptional({ type: String, nullable: true })
  failureReason: AnalysisFailure | null;
}
