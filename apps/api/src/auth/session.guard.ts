import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError } from '../platform/errors/app-error.js';
import { ErrorCode } from '../platform/errors/error-codes.js';
import { AuthService } from './auth.service.js';
import {
  ALLOWS_PENDING_SIGN_UP_KEY,
  type AuthenticatedRequest,
  IS_PUBLIC_KEY,
} from './session.decorators.js';

/**
 * Requires a session on every endpoint except those marked `@Public()`, and refuses
 * suspended accounts. Status and role come from the database on each request (NFR-019).
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const session = await this.authService.sessionFor(request);
    if (session) {
      if (session.user.status === 'SUSPENDED') {
        throw new AppError(
          ErrorCode.ACCOUNT_SUSPENDED,
          HttpStatus.FORBIDDEN,
          'This account is suspended.',
        );
      }
      request.session = session;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    if (!session) {
      throw new AppError(
        ErrorCode.NOT_SIGNED_IN,
        HttpStatus.UNAUTHORIZED,
        'This request needs a signed-in account.',
      );
    }

    /*
     * A provider sign-up holds a session before it has accepted the Terms, so the
     * account exists but must not be usable yet (FR-090, U5). Only the Terms step
     * and the account endpoint that drives it are reachable until then.
     */
    if (!session.user.termsAccepted) {
      const allowsPending = this.reflector.getAllAndOverride<boolean>(
        ALLOWS_PENDING_SIGN_UP_KEY,
        [context.getHandler(), context.getClass()],
      );
      if (!allowsPending) {
        throw new AppError(
          ErrorCode.TERMS_PENDING,
          HttpStatus.FORBIDDEN,
          'The Terms of Use must be accepted before this account can be used.',
        );
      }
    }
    return true;
  }
}
