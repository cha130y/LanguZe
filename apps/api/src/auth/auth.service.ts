import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APIError } from 'better-auth/api';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request, Response } from 'express';
import {
  NodeEnv,
  type EnvironmentVariables,
} from '../config/env.validation.js';
import { isPlaceholderAddress } from '../platform/email/placeholder-address.js';
import { AppError } from '../platform/errors/app-error.js';
import { ErrorCode } from '../platform/errors/error-codes.js';
import { PhotoDeletionReason } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AGE_BLOCK_COOKIE,
  AGE_BLOCK_DURATION_MS,
  hasAgeBlockCookie,
  isOldEnough,
} from './age-gate.js';
import { AUTH } from './auth.tokens.js';
import { CREDENTIAL_PROVIDER } from './secure-linked-account.js';
import type { Auth } from './create-auth.js';
import type {
  AcceptTermsDto,
  MeResponseDto,
  ProvidersResponseDto,
  SignInDto,
  SignUpDto,
} from './dto/auth.dto.js';

/** Better Auth error codes that LanguZe answers with a code of its own. */
const ERROR_CODE_MAP: Record<
  string,
  { code: ErrorCode; status: HttpStatus; message: string }
> = {
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: {
    code: ErrorCode.EMAIL_ALREADY_REGISTERED,
    status: HttpStatus.CONFLICT,
    message: 'This email address already has an account.',
  },
  USER_ALREADY_EXISTS: {
    code: ErrorCode.EMAIL_ALREADY_REGISTERED,
    status: HttpStatus.CONFLICT,
    message: 'This email address already has an account.',
  },
  INVALID_EMAIL_OR_PASSWORD: {
    code: ErrorCode.INVALID_CREDENTIALS,
    status: HttpStatus.UNAUTHORIZED,
    message: 'The email address or password is incorrect.',
  },
  INVALID_PASSWORD: {
    code: ErrorCode.INVALID_CREDENTIALS,
    status: HttpStatus.UNAUTHORIZED,
    message: 'The email address or password is incorrect.',
  },
  INVALID_TOKEN: {
    code: ErrorCode.INVALID_TOKEN,
    status: HttpStatus.BAD_REQUEST,
    message: 'The link is no longer valid.',
  },
  TOKEN_EXPIRED: {
    code: ErrorCode.INVALID_TOKEN,
    status: HttpStatus.BAD_REQUEST,
    message: 'The link is no longer valid.',
  },
};

export interface SessionContext {
  user: {
    id: string;
    role: string;
    status: string;
    /** False while a provider sign-up has not accepted the Terms yet (FR-090, U5). */
    termsAccepted: boolean;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly isProduction: boolean;

  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    private readonly prisma: PrismaService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.isProduction =
      config.get('NODE_ENV', { infer: true }) === NodeEnv.Production;
  }

  /** Signs up with email (US-001): age gate, Terms, then Better Auth. */
  async signUp(
    dto: SignUpDto,
    req: Request,
    res: Response,
  ): Promise<MeResponseDto> {
    if (!dto.acceptTerms) {
      throw new AppError(
        ErrorCode.TERMS_NOT_ACCEPTED,
        HttpStatus.BAD_REQUEST,
        'The Terms of Use and Privacy Policy must be accepted.',
      );
    }
    this.checkAge(dto.birthYear, req, res);

    const { headers, response } = await this.call(() =>
      this.auth.api.signUpEmail({
        body: {
          email: dto.email,
          password: dto.password,
          name: dto.name,
          birthYear: dto.birthYear,
        },
        returnHeaders: true,
      }),
    );

    this.forwardCookies(headers, res);
    return this.me(response.user.id);
  }

  /** Signs in with email (US-003). A suspended account is refused after the password check. */
  async signIn(dto: SignInDto, res: Response): Promise<MeResponseDto> {
    const { headers, response } = await this.call(() =>
      this.auth.api.signInEmail({
        body: { email: dto.email, password: dto.password },
        returnHeaders: true,
      }),
    );

    const account = await this.prisma.user.findUniqueOrThrow({
      where: { id: response.user.id },
      select: { status: true },
    });
    if (account.status === 'SUSPENDED') {
      // The password was right, so the person may be told; end every session of the account.
      await this.prisma.session.deleteMany({
        where: { userId: response.user.id },
      });
      throw new AppError(
        ErrorCode.ACCOUNT_SUSPENDED,
        HttpStatus.FORBIDDEN,
        'This account is suspended.',
      );
    }

    this.forwardCookies(headers, res);
    return this.me(response.user.id);
  }

  /** Ends the session of this browser (US-003). */
  async signOut(req: Request, res: Response): Promise<void> {
    const { headers } = await this.call(() =>
      this.auth.api.signOut({
        headers: fromNodeHeaders(req.headers),
        returnHeaders: true,
      }),
    );
    this.forwardCookies(headers, res);
  }

  /** Sends a new verification email (US-002). Unknown addresses are answered the same way. */
  async sendVerificationEmail(email: string): Promise<void> {
    try {
      await this.auth.api.sendVerificationEmail({ body: { email } });
    } catch (error) {
      // Never reveal whether an address has an account, or is already verified.
      this.logger.log(`Verification email not sent: ${this.reasonOf(error)}`);
    }
  }

  /** Marks the email address as verified (US-002). */
  async verifyEmail(token: string): Promise<void> {
    await this.call(() => this.auth.api.verifyEmail({ query: { token } }));
  }

  /** Starts a password reset (US-007). The answer never reveals whether the address is known. */
  async requestPasswordReset(email: string): Promise<void> {
    try {
      await this.auth.api.requestPasswordReset({ body: { email } });
    } catch (error) {
      this.logger.log(`Password reset not started: ${this.reasonOf(error)}`);
    }
  }

  /** Sets a new password and signs every device out (US-007, S7). */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    await this.call(() =>
      this.auth.api.resetPassword({ body: { token, newPassword } }),
    );
  }

  /** The session behind a request, or undefined when there is none. */
  async sessionFor(req: Request): Promise<SessionContext | undefined> {
    const session = await this.auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) return undefined;

    const user = session.user as {
      id: string;
      role?: string;
      status?: string;
      termsAcceptedAt?: Date | string | null;
    };
    return {
      user: {
        id: user.id,
        role: user.role ?? 'LEARNER',
        status: user.status ?? 'ACTIVE',
        // Null for a provider sign-up that has not finished the Terms step (FR-090).
        termsAccepted: user.termsAcceptedAt != null,
      },
    };
  }

  /**
   * The provider sign-ins on offer (FR-003). Read from Better Auth itself rather
   * than from a list of names, so a provider whose credentials are missing is
   * never shown as a button that cannot work.
   */
  providers(): ProvidersResponseDto {
    return { providers: Object.keys(this.auth.options.socialProviders ?? {}) };
  }

  /**
   * Whether the account may use the AI features: a verified email address, or any
   * provider sign-in, which counts as verified (V13, V14, FR-006).
   */
  async isVerifiedForAi(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        emailVerified: true,
        accounts: {
          where: { providerId: { not: CREDENTIAL_PROVIDER } },
          select: { id: true },
          take: 1,
        },
      },
    });
    return user !== null && (user.emailVerified || user.accounts.length > 0);
  }

  /** The account and what it may do (API design, section 3.2). */
  async me(userId: string): Promise<MeResponseDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        role: true,
        termsAcceptedAt: true,
        accounts: {
          where: { providerId: { not: 'credential' } },
          select: { id: true },
          take: 1,
        },
      },
    });

    // Signing in with Google, LINE, or Facebook counts as verified (V13, V14).
    const verifiedForAi = user.emailVerified || user.accounts.length > 0;
    return {
      id: user.id,
      name: user.name,
      // A placeholder address is not a contact address, so it is never shown (D1).
      email: isPlaceholderAddress(user.email) ? null : user.email,
      emailVerified: user.emailVerified,
      verifiedForAi,
      role: user.role,
      termsAccepted: user.termsAcceptedAt !== null,
      aiAccess: {
        available: verifiedForAi,
        reason: verifiedForAi ? null : 'NOT_VERIFIED',
      },
    };
  }

  /**
   * Finishes a provider sign-up: the Terms, the display name, and the year of birth
   * (FR-090, V20). Until this runs the account exists but cannot be used.
   */
  async acceptTerms(
    userId: string,
    dto: AcceptTermsDto,
    req: Request,
    res: Response,
  ): Promise<MeResponseDto> {
    this.checkAge(dto.birthYear, req, res);

    /*
     * Only a pending sign-up is touched. The endpoint is reachable by any signed-in
     * account, so without this condition an established learner could rewrite their
     * own name and year of birth through it.
     */
    const { count } = await this.prisma.user.updateMany({
      where: { id: userId, termsAcceptedAt: null },
      data: {
        name: dto.name,
        birthYear: dto.birthYear,
        termsAcceptedAt: new Date(),
      },
    });

    if (count === 0) {
      throw new AppError(
        ErrorCode.TERMS_NOT_ACCEPTED,
        HttpStatus.CONFLICT,
        'This account has already accepted the Terms of Use.',
      );
    }

    return this.me(userId);
  }

  /**
   * Declining leaves nothing behind (FR-090, U5): the pending account is removed,
   * taking its session and provider link with it through the cascade.
   */
  async declineTerms(
    userId: string,
    req: Request,
    res: Response,
  ): Promise<void> {
    // Again only a pending sign-up, so this can never delete an established account.
    await this.prisma.user.deleteMany({
      where: { id: userId, termsAcceptedAt: null },
    });
    await this.signOut(req, res);
  }

  /**
   * Deletes the account and everything belonging to it (FR-007, US-009).
   *
   * The browser is signed out first, so the answer carries Better Auth's own
   * cookie-clearing headers, and the row goes last: if anything fails, the account
   * survives rather than being half removed. Sessions and provider sign-ins go with
   * it through the schema's cascades, and so will worlds, photos, and the rest as
   * those tables arrive (data model). Stored photos are removed separately, within
   * 24 hours (NFR-009, V10), which the storage module adds in its own increment.
   */
  async deleteAccount(userId: string, req: Request, res: Response) {
    await this.signOut(req, res);

    const photos = await this.prisma.storedPhoto.findMany({
      where: { ownerId: userId },
      select: { storageKey: true },
    });

    /*
     * One transaction, because a cleanup record that is not written is a photo kept
     * for ever: the rows that name it disappear with the account. The files
     * themselves are removed by the cleanup task, within 24 hours (V10).
     */
    await this.prisma.$transaction([
      this.prisma.photoDeletion.createMany({
        data: photos.map(({ storageKey }) => ({
          storageKey,
          reason: PhotoDeletionReason.ACCOUNT_DELETED,
        })),
      }),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);
  }

  private checkAge(birthYear: number, req: Request, res: Response): void {
    const tooYoung = !isOldEnough(birthYear);
    if (!tooYoung && !hasAgeBlockCookie(req.headers.cookie)) return;

    if (tooYoung) {
      // Stop the same browser from trying another year straight away (V20).
      res.cookie(AGE_BLOCK_COOKIE, '1', {
        httpOnly: true,
        sameSite: 'lax',
        secure: this.isProduction,
        maxAge: AGE_BLOCK_DURATION_MS,
      });
    }

    throw new AppError(
      ErrorCode.AGE_BELOW_MINIMUM,
      HttpStatus.FORBIDDEN,
      'LanguZe is for people aged 18 or older.',
    );
  }

  /** Runs a Better Auth call and turns its errors into LanguZe errors. */
  private async call<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof APIError)) throw error;

      const known = ERROR_CODE_MAP[this.codeOf(error)];
      if (known) throw new AppError(known.code, known.status, known.message);

      this.logger.warn(`Unmapped authentication error: ${this.codeOf(error)}`);
      throw new AppError(
        ErrorCode.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
        'The request could not be completed.',
      );
    }
  }

  private codeOf(error: APIError): string {
    const body = error.body as { code?: unknown } | undefined;
    return typeof body?.code === 'string' ? body.code : error.message;
  }

  private reasonOf(error: unknown): string {
    return error instanceof APIError ? this.codeOf(error) : 'unexpected error';
  }

  private forwardCookies(headers: Headers, res: Response): void {
    for (const cookie of headers.getSetCookie()) {
      res.append('Set-Cookie', cookie);
    }
  }
}
