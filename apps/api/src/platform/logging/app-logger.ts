import { ConsoleLogger, type LogLevel } from '@nestjs/common';
import { currentRequestId } from '../request-context/request-context.js';

type JsonLogOptions = {
  context: string;
  logLevel: LogLevel;
  writeStreamType?: 'stdout' | 'stderr';
  errorStack?: unknown;
  params?: Record<string, any>;
};

/**
 * Nest's console logger with the current request ID on every line (NFR-016).
 * JSON output in production; readable, coloured output in development.
 * Never log passwords, tokens, photos, prompts, or tutor text (NFR-008).
 */
export class AppLogger extends ConsoleLogger {
  protected override getJsonLogObject(
    message: unknown,
    options: JsonLogOptions,
  ): ReturnType<ConsoleLogger['getJsonLogObject']> {
    const logObject = super.getJsonLogObject(message, options);
    const requestId = currentRequestId();
    return requestId ? { ...logObject, requestId } : logObject;
  }

  protected override formatContext(context: string): string {
    const requestId = currentRequestId();
    const formatted = super.formatContext(context);
    return requestId ? `${formatted}(${requestId.slice(0, 8)}) ` : formatted;
  }
}
