import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from './config/env.validation.js';
import { AllExceptionsFilter } from './platform/errors/all-exceptions.filter.js';
import { validationErrorFactory } from './platform/errors/validation-error.factory.js';
import { requestLoggingMiddleware } from './platform/logging/request-logging.middleware.js';
import { requestContextMiddleware } from './platform/request-context/request-context.js';

/** LanguZe endpoints live under /v1; the health check stays at the root (API design, E1). */
export const API_PREFIX = 'v1';

/**
 * Application-wide HTTP configuration shared by the runtime bootstrap and e2e tests,
 * so tests exercise the same validation, errors, CORS, and prefix as the running API.
 */
export function configureApp(app: INestApplication): void {
  const config =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  // Registered first so every later step, including errors, knows the request ID.
  app.use(requestContextMiddleware);
  app.use(requestLoggingMiddleware);

  app.setGlobalPrefix(API_PREFIX, { exclude: ['health'] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationErrorFactory,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  // Credentials are allowed so the browser sends the session cookie (ADR-0003, A1).
  app.enableCors({
    origin: config.get('WEB_ORIGIN', { infer: true }),
    credentials: true,
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
  });
  app.enableShutdownHooks();
}
