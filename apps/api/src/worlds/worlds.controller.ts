import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { SessionContext } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/session.decorators.js';
import { ErrorResponseDto } from '../platform/errors/error-response.dto.js';
import {
  CreateWorldDto,
  RenameWorldDto,
  WorldDetailDto,
  WorldStatusDto,
  WorldSummaryDto,
} from './dto/worlds.dto.js';
import {
  MAX_PHOTO_BYTES,
  WorldsService,
  type UploadedPhoto,
} from './worlds.service.js';

/** Photo upload and retry are the expensive ones (API design, section 5). */
const UPLOAD_LIMIT = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('worlds')
@Controller('worlds')
export class WorldsController {
  constructor(private readonly worlds: WorldsService) {}

  @Get()
  @ApiOkResponse({ type: WorldSummaryDto, isArray: true })
  list(
    @CurrentUser() user: SessionContext['user'],
  ): Promise<WorldSummaryDto[]> {
    return this.worlds.list(user.id);
  }

  @Post()
  @Throttle(UPLOAD_LIMIT)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'photo'],
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 50 },
        photo: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiCreatedResponse({ type: WorldDetailDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto, description: 'NOT_VERIFIED' })
  /*
   * The file is kept in memory, never on disk: it is small by definition (FR-011),
   * it is reshaped before anything is stored, and a temporary file would be one more
   * copy of a learner's photo to remove.
   */
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: { fileSize: MAX_PHOTO_BYTES, files: 1 },
    }),
  )
  create(
    @CurrentUser() user: SessionContext['user'],
    @Body() dto: CreateWorldDto,
    @UploadedFile() photo: UploadedPhoto | undefined,
  ): Promise<WorldDetailDto> {
    return this.worlds.create(user.id, dto.name, photo);
  }

  @Get(':worldId')
  @ApiOkResponse({ type: WorldDetailDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'NOT_FOUND' })
  get(
    @CurrentUser() user: SessionContext['user'],
    @Param('worldId', ParseUUIDPipe) worldId: string,
  ): Promise<WorldDetailDto> {
    return this.worlds.get(user.id, worldId);
  }

  @Get(':worldId/status')
  @ApiOkResponse({ type: WorldStatusDto })
  status(
    @CurrentUser() user: SessionContext['user'],
    @Param('worldId', ParseUUIDPipe) worldId: string,
  ): Promise<WorldStatusDto> {
    return this.worlds.status(user.id, worldId);
  }

  @Patch(':worldId')
  @ApiOkResponse({ type: WorldDetailDto })
  rename(
    @CurrentUser() user: SessionContext['user'],
    @Param('worldId', ParseUUIDPipe) worldId: string,
    @Body() dto: RenameWorldDto,
  ): Promise<WorldDetailDto> {
    return this.worlds.rename(user.id, worldId, dto.name);
  }

  @Delete(':worldId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(
    @CurrentUser() user: SessionContext['user'],
    @Param('worldId', ParseUUIDPipe) worldId: string,
  ): Promise<void> {
    return this.worlds.remove(user.id, worldId);
  }
}
