import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import { AppError } from '../errors/app-error.js';
import { ErrorCode } from '../errors/error-codes.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Refuses requests that change data unless they come from the web app's origin
 * (API design, section 2.3). Together with `SameSite=Lax` session cookies this blocks
 * cross-site request forgery, including form-style requests that skip CORS preflight.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowedOrigins: ReadonlySet<string>;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    // Browsers send the origin without a path or trailing slash, so compare normalized origins.
    this.allowedOrigins = new Set([
      new URL(config.get('WEB_ORIGIN', { infer: true })).origin,
    ]);
  }

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;

    const origin = request.headers.origin;
    if (origin && this.allowedOrigins.has(origin)) return true;

    throw new AppError(
      ErrorCode.ORIGIN_NOT_ALLOWED,
      HttpStatus.FORBIDDEN,
      'Requests that change data must come from the LanguZe web app.',
    );
  }
}
