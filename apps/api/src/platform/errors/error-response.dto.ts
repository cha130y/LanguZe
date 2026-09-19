import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ErrorCode } from './error-codes.js';

export class ErrorBodyDto {
  @ApiProperty({ enum: Object.values(ErrorCode) })
  code: ErrorCode;

  @ApiProperty({
    description: 'English, for developers; never shown to learners as is.',
  })
  message: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  details?: Record<string, unknown>;
}

/** The body of every error response. */
export class ErrorResponseDto {
  @ApiProperty({ type: ErrorBodyDto })
  error: ErrorBodyDto;
}
