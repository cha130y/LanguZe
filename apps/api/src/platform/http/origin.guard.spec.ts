import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import { AppError } from '../errors/app-error.js';
import { ErrorCode } from '../errors/error-codes.js';
import { OriginGuard } from './origin.guard.js';

function contextFor(method: string, origin?: string): ExecutionContext {
  const request = { method, headers: origin ? { origin } : {} };
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('OriginGuard', () => {
  // A trailing slash in configuration must not matter: browsers send the bare origin.
  const config = {
    get: () => 'https://app.languze.example/',
  } as unknown as ConfigService<EnvironmentVariables, true>;
  const guard = new OriginGuard(config);

  it.each(['GET', 'HEAD', 'OPTIONS'])(
    'lets %s requests through without an origin',
    (method) => {
      expect(guard.canActivate(contextFor(method))).toBe(true);
    },
  );

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'allows %s from the web app origin',
    (method) => {
      expect(
        guard.canActivate(contextFor(method, 'https://app.languze.example')),
      ).toBe(true);
    },
  );

  it.each([
    ['without an Origin header', undefined],
    ['from another site', 'https://evil.example'],
    ['from a look-alike subdomain', 'https://app.languze.example.evil.example'],
    ['over plain HTTP', 'http://app.languze.example'],
  ])('refuses a request that changes data %s', (_label, origin) => {
    let error: unknown;
    try {
      guard.canActivate(contextFor('POST', origin));
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: ErrorCode.ORIGIN_NOT_ALLOWED });
    expect((error as AppError).getStatus()).toBe(403);
  });
});
