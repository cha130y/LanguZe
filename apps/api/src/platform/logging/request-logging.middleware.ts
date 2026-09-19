import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import {
  currentRequestContext,
  runInRequestContext,
} from '../request-context/request-context.js';

const logger = new Logger('Http');

/**
 * Logs one line per finished request: method, path, status, and duration.
 * The query string is left out, because it can hold personal data such as an email address.
 * Health checks are not logged, so uptime monitors do not flood the logs.
 */
export function requestLoggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const path = req.originalUrl.split('?')[0];
  if (path === '/health') {
    next();
    return;
  }

  const startedAt = performance.now();
  const context = currentRequestContext();

  res.on('finish', () => {
    const durationMs = Math.round(performance.now() - startedAt);
    // The response event runs outside the request's async context, so restore it for the log line.
    runInRequestContext(context, () =>
      logger.log(`${req.method} ${path} ${res.statusCode} ${durationMs}ms`),
    );
  });
  next();
}
