import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { IsEnum, IsInt, IsUrl, Max, Min, validateSync } from 'class-validator';

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
