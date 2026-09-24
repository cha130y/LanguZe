import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ErrorResponseDto } from '../platform/errors/error-response.dto.js';
import { AuthService } from './auth.service.js';
import {
  AcceptTermsDto,
  AcknowledgementDto,
  EmailOnlyDto,
  MeResponseDto,
  ResetPasswordDto,
  SignInDto,
  ProvidersResponseDto,
  SignUpDto,
  VerifyEmailDto,
} from './dto/auth.dto.js';
import {
  AllowsPendingSignUp,
  CurrentUser,
  Public,
} from './session.decorators.js';
import type { SessionContext } from './auth.service.js';

/** Rate limits from the API design, section 5. */
const SIGN_IN_LIMIT = { default: { limit: 5, ttl: 15 * 60_000 } };
const SIGN_UP_LIMIT = { default: { limit: 5, ttl: 60 * 60_000 } };
const EMAIL_LIMIT = { default: { limit: 3, ttl: 60 * 60_000 } };

const ACKNOWLEDGED: AcknowledgementDto = { ok: true };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sign-up')
  @Public()
  @Throttle(SIGN_UP_LIMIT)
  @HttpCode(HttpStatus.CREATED)
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'EMAIL_ALREADY_REGISTERED',
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'AGE_BELOW_MINIMUM',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'TERMS_NOT_ACCEPTED, VALIDATION_FAILED',
  })
  signUp(
    @Body() dto: SignUpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MeResponseDto> {
    return this.authService.signUp(dto, req, res);
  }

  @Post('sign-in')
  @Public()
  @Throttle(SIGN_IN_LIMIT)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MeResponseDto })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'INVALID_CREDENTIALS',
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'ACCOUNT_SUSPENDED',
  })
  signIn(
    @Body() dto: SignInDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MeResponseDto> {
    return this.authService.signIn(dto, res);
  }

  @Post('sign-out')
  @HttpCode(HttpStatus.NO_CONTENT)
  signOut(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    return this.authService.signOut(req, res);
  }

  @Post('send-verification-email')
  @Public()
  @Throttle(EMAIL_LIMIT)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: AcknowledgementDto,
    description: 'Always the same answer (FR-005).',
  })
  async sendVerificationEmail(
    @Body() dto: EmailOnlyDto,
  ): Promise<AcknowledgementDto> {
    await this.authService.sendVerificationEmail(dto.email);
    return ACKNOWLEDGED;
  }

  @Post('verify-email')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AcknowledgementDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'INVALID_TOKEN',
  })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<AcknowledgementDto> {
    await this.authService.verifyEmail(dto.token);
    return ACKNOWLEDGED;
  }

  @Post('request-password-reset')
  @Public()
  @Throttle(EMAIL_LIMIT)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: AcknowledgementDto,
    description: 'Always the same answer (FR-005).',
  })
  async requestPasswordReset(
    @Body() dto: EmailOnlyDto,
  ): Promise<AcknowledgementDto> {
    await this.authService.requestPasswordReset(dto.email);
    return ACKNOWLEDGED;
  }

  @Post('reset-password')
  @Public()
  @Throttle(SIGN_IN_LIMIT)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AcknowledgementDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'INVALID_TOKEN',
  })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<AcknowledgementDto> {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return ACKNOWLEDGED;
  }

  @Get('providers')
  @Public()
  @ApiOkResponse({ type: ProvidersResponseDto })
  providers(): ProvidersResponseDto {
    return this.authService.providers();
  }
}

@ApiTags('account')
@Controller('me')
export class MeController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  // A provider sign-up reads this before accepting the Terms: it is how the web app
  // learns to show the Terms step rather than the home page (FR-090, U5).
  @AllowsPendingSignUp()
  @ApiOkResponse({ type: MeResponseDto })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'NOT_SIGNED_IN',
  })
  me(@CurrentUser() user: SessionContext['user']): Promise<MeResponseDto> {
    return this.authService.me(user.id);
  }

  /** Completes a pending provider sign-up (FR-090, V20). */
  @Post('terms')
  @AllowsPendingSignUp()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOkResponse({ type: MeResponseDto })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'AGE_BELOW_MINIMUM',
  })
  acceptTerms(
    @CurrentUser() user: SessionContext['user'],
    @Body() dto: AcceptTermsDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MeResponseDto> {
    return this.authService.acceptTerms(user.id, dto, req, res);
  }

  /** Declines the Terms: the pending sign-up is removed and the session ends (FR-090). */
  @Post('terms/decline')
  @AllowsPendingSignUp()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiNoContentResponse()
  declineTerms(
    @CurrentUser() user: SessionContext['user'],
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    return this.authService.declineTerms(user.id, req, res);
  }
}
