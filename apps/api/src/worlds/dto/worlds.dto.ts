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

/** One world with its photo (FR-014). Its words arrive with the analysis increment. */
export class WorldDetailDto extends WorldSummaryDto {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'A signed link to the prepared photo (P4).',
  })
  photoUrl: string | null;
}

/** Just the status, for the page that waits for an analysis (FR-021, P3). */
export class WorldStatusDto {
  @ApiProperty({ enum: ['ANALYZING', 'READY', 'FAILED'] })
  status: WorldStatus;

  @ApiPropertyOptional({ type: String, nullable: true })
  failureReason: AnalysisFailure | null;
}
