import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateIf,
} from 'class-validator';
import type {
  MasteryLevel,
  SessionKind,
  SessionStatus,
} from '../../generated/prisma/enums.js';
import { HighlightBoxDto } from '../../worlds/dto/worlds.dto.js';
import { MAX_ANSWER_LENGTH } from '../answer-check.js';

/** Reading the open session of one kind. A review has no world (FR-050). */
export class CurrentSessionQuery {
  @ApiProperty({ enum: ['GAME', 'REVIEW'] })
  @IsIn(['GAME', 'REVIEW'])
  kind: SessionKind;

  @ApiPropertyOptional({ format: 'uuid', description: 'Required for a game.' })
  @ValidateIf((query: CurrentSessionQuery) => query.kind === 'GAME')
  @IsUUID()
  worldId?: string;
}

/**
 * Starting a session. A game is of one world; a review draws from all of them by
 * a rule of its own (FR-030, FR-050), so it names no world.
 */
export class StartSessionDto {
  @ApiProperty({ enum: ['GAME', 'REVIEW'] })
  @IsIn(['GAME', 'REVIEW'])
  kind: SessionKind;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'The world to play; required for a game only (FR-030).',
  })
  @ValidateIf((body: StartSessionDto) => body.kind === 'GAME')
  @IsUUID()
  worldId?: string;
}

/**
 * One answer. Either the learner typed a word or they chose "I don't know"; an
 * empty answer is neither, and is refused rather than recorded as a mistake they
 * did not make (UC-031 1b).
 */
export class AnswerDto {
  @ApiPropertyOptional({ maxLength: MAX_ANSWER_LENGTH })
  @ValidateIf((body: AnswerDto) => body.dontKnow !== true)
  @IsString()
  @Length(1, MAX_ANSWER_LENGTH)
  answer?: string;

  @ApiPropertyOptional({ description: 'The learner gave up on this word.' })
  @IsOptional()
  @IsBoolean()
  dontKnow?: boolean;
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

/** A word that moved up or down during a session, and where it ended (FR-035). */
export class LevelChangeDto {
  @ApiProperty()
  english: string;

  @ApiProperty({ enum: ['LEARNING', 'FAMILIAR', 'MASTERED'] })
  level: MasteryLevel;
}

/** What the learner achieved in a session (FR-035, US-033). */
export class SessionSummaryDto {
  @ApiProperty()
  answeredCount: number;

  @ApiProperty()
  correctCount: number;

  @ApiProperty()
  xpEarned: number;

  @ApiProperty({ type: LevelChangeDto, isArray: true })
  levelChanges: LevelChangeDto[];
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

  @ApiPropertyOptional({
    type: SessionSummaryDto,
    nullable: true,
    description:
      'Only for a COMPLETED session. One left unfinished has none (FR-036).',
  })
  summary: SessionSummaryDto | null;
}

/** The word a question was about, shown only once it has been answered (FR-033). */
export class WordFeedbackDto {
  @ApiProperty()
  english: string;

  @ApiProperty()
  thaiMeaning: string;

  @ApiProperty()
  exampleSentence: string;
}

/** Where this answer left the word (SRS 4.1). `before` is empty when it was new. */
export class MasteryChangeDto {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    enum: ['LEARNING', 'FAMILIAR', 'MASTERED'],
  })
  before: MasteryLevel | null;

  @ApiProperty({ enum: ['LEARNING', 'FAMILIAR', 'MASTERED'] })
  after: MasteryLevel;
}

/** The feedback one answer earns (FR-033). */
export class AnswerResultDto {
  @ApiProperty()
  correct: boolean;

  @ApiProperty()
  dontKnow: boolean;

  @ApiProperty({
    description:
      'This question was already answered; nothing was recorded again (FR-034).',
  })
  alreadyAnswered: boolean;

  @ApiProperty({ type: WordFeedbackDto })
  word: WordFeedbackDto;

  @ApiProperty()
  xpAwarded: number;

  @ApiProperty({ type: MasteryChangeDto })
  mastery: MasteryChangeDto;

  @ApiProperty()
  sessionCompleted: boolean;

  @ApiPropertyOptional({ type: SessionSummaryDto, nullable: true })
  summary: SessionSummaryDto | null;
}
