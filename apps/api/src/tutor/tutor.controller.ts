import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { SessionContext } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/session.decorators.js';
import { ConversationQuery, TutorConversationDto } from './dto/tutor.dto.js';
import { TutorService } from './tutor.service.js';

@ApiTags('tutor')
@Controller('tutor/messages')
export class TutorController {
  constructor(private readonly tutor: TutorService) {}

  /** The conversation, newest first (FR-070). */
  @Get()
  @ApiOkResponse({ type: TutorConversationDto })
  conversation(
    @CurrentUser() user: SessionContext['user'],
    @Query() query: ConversationQuery,
  ): Promise<TutorConversationDto> {
    return this.tutor.conversation(user.id, query.before);
  }

  /** Throws the conversation away (FR-076, US-073). */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  clear(@CurrentUser() user: SessionContext['user']): Promise<void> {
    return this.tutor.clear(user.id);
  }
}
