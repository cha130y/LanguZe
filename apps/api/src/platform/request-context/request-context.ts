import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export interface RequestContext {
  requestId: string;
}

export const REQUEST_ID_HEADER = 'X-Request-Id';

// An incoming ID is reused only when it is short and plain, so it cannot inject text into logs.
const ACCEPTED_REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

const storage = new AsyncLocalStorage<RequestContext>();

/** The context of the request being handled, if any. */
export function currentRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function currentRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

/** Runs `fn` inside a request context, for callbacks that lose it (such as response events). */
export function runInRequestContext<T>(
  context: RequestContext | undefined,
  fn: () => T,
): T {
  return context ? storage.run(context, fn) : fn();
}

/** Reuses a well-formed incoming request ID, for example from a proxy, or creates one. */
export function resolveRequestId(
  incoming: string | string[] | undefined,
): string {
  return typeof incoming === 'string' && ACCEPTED_REQUEST_ID.test(incoming)
    ? incoming
    : randomUUID();
}

/**
 * Express middleware, registered first: gives every request an ID, returns it in the
 * `X-Request-Id` response header, and makes it available to logs and error responses.
 */
export function requestContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const requestId = resolveRequestId(req.headers['x-request-id']);
  res.setHeader(REQUEST_ID_HEADER, requestId);
  storage.run({ requestId }, next);
}
