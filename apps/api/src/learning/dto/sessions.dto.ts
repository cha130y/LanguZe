import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';
import type {
  SessionKind,
  SessionStatus,
} from '../../generated/prisma/enums.js';
import { HighlightBoxDto } from '../../worlds/dto/worlds.dto.js';

/**
 * Starting a session. Only `GAME` for now: a review picks its words from every
 * world by a rule of its own (FR-050), which arrives with the review increment.
 * Naming a kind the API cannot serve would be a promise it could not keep.
 */
/** Reading the open session of one kind. Only `GAME` until review is built. */
export class CurrentSessionQuery {
  @ApiProperty({ enum: ['GAME'] })
  @IsIn(['GAME'])
  kind: 'GAME';

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  worldId: string;
}

export class StartSessionDto {
  @ApiProperty({ enum: ['GAME'] })
  @IsIn(['GAME'])
  kind: 'GAME';

  @ApiProperty({ format: 'uuid', description: 'The world to play (FR-030).' })
  @IsUUID()
  worldId: string;
}

/**
 * One question as the learner sees it: the photo and the box around the object,
 * and nothing else. The word, its meaning, and its accepted variants are not here
 * and never will be — an answer that is in the page is not an answer (FR-032, S5).
 */
export class QuestionDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'Which of the session’s questions this is.' })
  position: number;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'A signed link to the world’s photo (P4).',
  })
  photoUrl: string | null;

  @ApiProperty({ type: HighlightBoxDto })
  box: HighlightBoxDto;
}

/** A session and where the learner has got to in it (FR-031, FR-036). */
export class SessionDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: ['GAME', 'REVIEW'] })
  kind: SessionKind;

  @ApiProperty({ enum: ['IN_PROGRESS', 'COMPLETED', 'ABANDONED'] })
  status: SessionStatus;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'The world being played; empty for a review.',
  })
  worldId: string | null;

  @ApiProperty()
  answeredCount: number;

  @ApiProperty()
  questionCount: number;

  @ApiPropertyOptional({
    type: QuestionDto,
    nullable: true,
    description: 'What to ask next; empty when nothing is left to ask.',
  })
  nextQuestion: QuestionDto | null;

  @ApiProperty()
  startedAt: string;
}
