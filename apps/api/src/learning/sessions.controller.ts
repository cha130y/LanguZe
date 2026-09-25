import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { SessionContext } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/session.decorators.js';
import { ErrorResponseDto } from '../platform/errors/error-response.dto.js';
import { AttemptsService } from './attempts.service.js';
import {
  AnswerDto,
  AnswerResultDto,
  CurrentSessionQuery,
  SessionDto,
  StartSessionDto,
} from './dto/sessions.dto.js';
import { SessionsService } from './sessions.service.js';

/** Starting a game costs a write and a read of every word, so it is not free. */
const START_LIMIT = { default: { limit: 20, ttl: 60_000 } };

@ApiTags('sessions')
@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly sessions: SessionsService,
    private readonly attempts: AttemptsService,
  ) {}

  /**
   * The session still open for a world, if any (FR-036). `204` means there is
   * none, which the page reads as "offer a new game" rather than as an error.
   */
  @Get('current')
  @ApiOkResponse({ type: SessionDto })
  @ApiNoContentResponse({ description: 'No session is open.' })
  async current(
    @CurrentUser() user: SessionContext['user'],
    @Query() query: CurrentSessionQuery,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionDto | undefined> {
    const session = await this.sessions.current(user.id, query.worldId);
    if (!session) {
      res.status(HttpStatus.NO_CONTENT);
      return undefined;
    }
    return session;
  }

  @Post()
  @Throttle(START_LIMIT)
  @ApiCreatedResponse({ type: SessionDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'NOT_FOUND' })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'WORLD_NOT_READY',
  })
  start(
    @CurrentUser() user: SessionContext['user'],
    @Body() dto: StartSessionDto,
  ): Promise<SessionDto> {
    return this.sessions.start(user.id, dto.worldId);
  }

  @Get(':sessionId')
  @ApiOkResponse({ type: SessionDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'NOT_FOUND' })
  get(
    @CurrentUser() user: SessionContext['user'],
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ): Promise<SessionDto> {
    return this.sessions.get(user.id, sessionId);
  }

  /**
   * One answer (FR-032 to FR-034). Answering the same question twice records
   * nothing further and gives no more XP; the recorded result comes back instead.
   */
  @Post(':sessionId/questions/:questionId/answer')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AnswerResultDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'NOT_FOUND' })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'SESSION_CLOSED or QUESTION_UNAVAILABLE',
  })
  answer(
    @CurrentUser() user: SessionContext['user'],
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() body: AnswerDto,
  ): Promise<AnswerResultDto> {
    return this.attempts.answer(user.id, sessionId, questionId, body);
  }
}
