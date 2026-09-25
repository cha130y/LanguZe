import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { SessionContext } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/session.decorators.js';
import { ProgressDto } from './dto/progress.dto.js';
import { ProgressService } from './progress.service.js';

@ApiTags('progress')
@Controller('progress')
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  /** Total XP, words at each level, and each world's share (FR-061, US-060). */
  @Get()
  @ApiOkResponse({ type: ProgressDto })
  get(@CurrentUser() user: SessionContext['user']): Promise<ProgressDto> {
    return this.progress.of(user.id);
  }
}
