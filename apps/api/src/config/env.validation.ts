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
