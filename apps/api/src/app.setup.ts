import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { toNodeHandler } from 'better-auth/node';
import { AUTH } from './auth/auth.tokens.js';
import type { Auth } from './auth/create-auth.js';
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
 *
 * The application must be created with `bodyParser: false`: Better Auth's handler
 * reads the raw request body, so JSON parsing is turned on again only after it is
 * mounted (ADR-0003).
 */
export function configureApp(app: NestExpressApplication): void {
  const config =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  // Registered first so every later step, including errors, knows the request ID.
  app.use(requestContextMiddleware);
  app.use(requestLoggingMiddleware);

  /*
   * CORS comes before the Better Auth handler, not after it. Express runs middleware
   * in the order it is registered, so a handler mounted first answers /auth requests
   * — including the browser's OPTIONS preflight, which Better Auth does not handle —
   * before CORS ever sees them. The browser then blocks the request outright, and
   * provider sign-in does nothing at all when clicked. Credentials are allowed so
   * the browser sends the session cookie (ADR-0003, A1).
   */
  app.enableCors({
    origin: config.get('WEB_ORIGIN', { infer: true }),
    credentials: true,
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
  });

  /*
   * Better Auth serves the provider callbacks itself at /auth (API design, E1):
   * a provider redirects the browser there, so there is no LanguZe controller in
   * front of it. It needs the unparsed body, which is why it is mounted before
   * JSON parsing is switched back on, and why the application is created without
   * a body parser.
   */
  app.use('/auth', toNodeHandler(app.get<Auth>(AUTH)));
  app.useBodyParser('json');

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
  app.enableShutdownHooks();
}
