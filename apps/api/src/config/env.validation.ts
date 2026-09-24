import 'reflect-metadata';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 4001;

  @IsUrl({
    protocols: ['postgres', 'postgresql'],
    require_protocol: true,
    require_tld: false,
  })
  DATABASE_URL: string;

  @IsUrl({ require_protocol: true, require_tld: false })
  WEB_ORIGIN: string = 'http://localhost:3003';

  // Usage limits (SRS FR-012, FR-020, FR-071), configurable per environment (FR-081).
  @IsInt()
  @Min(1)
  @Max(1000)
  WORLD_LIMIT: number = 20;

  @IsInt()
  @Min(1)
  @Max(1000)
  DAILY_ANALYSIS_LIMIT: number = 10;

  @IsInt()
  @Min(1)
  @Max(10000)
  DAILY_TUTOR_MESSAGE_LIMIT: number = 30;

  // Requests per minute per account, or per IP address when signed out (API design, section 5).
  @IsInt()
  @Min(1)
  @Max(100000)
  RATE_LIMIT_PER_MINUTE: number = 120;

  // Signs session cookies and tokens (ADR-0003). At least 32 characters, different per environment.
  @IsString()
  @MinLength(32)
  AUTH_SECRET: string;

  // The API's own address, used to build the links in emails.
  @IsUrl({ require_protocol: true, require_tld: false })
  AUTH_URL: string = 'http://localhost:4001';

  // Outgoing email (Maildev locally, an email provider in production).
  @IsString()
  @IsNotEmpty()
  MAIL_HOST: string = 'localhost';

  @IsInt()
  @Min(1)
  @Max(65535)
  MAIL_PORT: number = 1026;

  @IsString()
  @IsNotEmpty()
  MAIL_FROM: string = 'LanguZe <no-reply@languze.local>';

  // Credentials for the email provider. Empty locally: Maildev accepts anonymous mail.
  @IsString()
  MAIL_USER: string = '';

  @IsString()
  MAIL_PASSWORD: string = '';

  /**
   * The domain the session cookie is set on, so the web app and the API can both
   * read it across subdomains in production (H5). Empty locally, where both run on
   * `localhost` and cookies are already shared.
   */
  @IsString()
  COOKIE_DOMAIN: string = '';

  /**
   * Google sign-in (FR-003). Empty until a developer registers an OAuth client,
   * and the provider is simply not offered while either value is missing, so the
   * API still starts for anyone working on something else.
   */
  @IsString()
  GOOGLE_CLIENT_ID: string = '';

  @IsString()
  GOOGLE_CLIENT_SECRET: string = '';

  /**
   * What the fake AI provider does (B4), so a developer can see a blocked photo or
   * a provider error without a real key: ALLOWED, BLOCKED, PROVIDER_ERROR,
   * TIMED_OUT, TOO_FEW_WORDS, or INVALID_OUTPUT.
   */
  @IsIn([
    'ALLOWED',
    'BLOCKED',
    'PROVIDER_ERROR',
    'TIMED_OUT',
    'TOO_FEW_WORDS',
    'INVALID_OUTPUT',
  ])
  AI_FAKE_BEHAVIOUR: string = 'ALLOWED';

  /**
   * Photo storage (A3): SeaweedFS from docker-compose locally, Cloudflare R2 in
   * production. Both speak S3, so only these values differ between them.
   */
  @IsString()
  @IsNotEmpty()
  STORAGE_ENDPOINT: string = 'http://localhost:8334';

  /** R2 has one region, named `auto`; SeaweedFS ignores the value but needs one. */
  @IsString()
  @IsNotEmpty()
  STORAGE_REGION: string = 'auto';

  @IsString()
  @IsNotEmpty()
  STORAGE_BUCKET: string = 'languze-photos';

  @IsString()
  STORAGE_ACCESS_KEY_ID: string = 'languze';

  @IsString()
  STORAGE_SECRET_ACCESS_KEY: string = 'languze';

  /** How long a signed photo link stays valid (P4, API design, section 5). */
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(3600)
  PHOTO_LINK_TTL_SECONDS: number = 900;

  /**
   * LINE sign-in (FR-003), from one LINE Login channel for Thailand (ADR-0003).
   * Optional in the same way as Google.
   */
  @IsString()
  LINE_CLIENT_ID: string = '';

  @IsString()
  LINE_CLIENT_SECRET: string = '';
}

/**
 * Validates process environment at startup so misconfiguration fails fast.
 * Error messages name the invalid variables but never echo their values.
 */
export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(env);

  if (errors.length > 0) {
    const invalid = errors.map((error) => error.property).join(', ');
    throw new Error(`Invalid environment variables: ${invalid}`);
  }

  return env;
}
