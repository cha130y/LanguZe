import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Request } from 'express';
import type { SessionContext } from './auth.service.js';

export const IS_PUBLIC_KEY = 'languze:isPublic';

/** Marks an endpoint as reachable without signing in; everything else needs a session. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ALLOWS_PENDING_SIGN_UP_KEY = 'languze:allowsPendingSignUp';

/**
 * Marks an endpoint a provider sign-up may reach before accepting the Terms of Use.
 * Only the Terms step itself and the account endpoint that drives it qualify: until
 * the Terms are accepted the account is not usable (FR-090, U5).
 */
export const AllowsPendingSignUp = () =>
  SetMetadata(ALLOWS_PENDING_SIGN_UP_KEY, true);

export interface AuthenticatedRequest extends Request {
  session?: SessionContext;
}

/** The signed-in account, taken from the session and never from request input (FR-008). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionContext['user'] => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.session) {
      throw new Error(
        'CurrentUser used on an endpoint without the session guard',
      );
    }
    return request.session.user;
  },
);
