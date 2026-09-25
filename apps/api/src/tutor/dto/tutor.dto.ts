import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import type { TutorRole } from '../../generated/prisma/enums.js';

/** Reading older messages: where the last page stopped. */
export class ConversationQuery {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'The oldest message already seen; older ones follow it.',
  })
  @IsOptional()
  @IsUUID()
  before?: string;
}

/** One thing said, by the learner or by the tutor. */
export class TutorMessageDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: ['LEARNER', 'TUTOR'] })
  role: TutorRole;

  @ApiProperty()
  content: string;

  @ApiProperty()
  createdAt: string;
}

/** A page of the learner's one conversation, newest first (FR-070, V6). */
export class TutorConversationDto {
  @ApiProperty({ type: TutorMessageDto, isArray: true })
  messages: TutorMessageDto[];

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Pass as `before` for older messages; empty at the beginning.',
  })
  nextCursor: string | null;
}
