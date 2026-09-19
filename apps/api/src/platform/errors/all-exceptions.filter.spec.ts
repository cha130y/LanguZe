import {
  BadRequestException,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { runInRequestContext } from '../request-context/request-context.js';
import { AllExceptionsFilter } from './all-exceptions.filter.js';
import { AppError } from './app-error.js';
import { ErrorCode } from './error-codes.js';

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  beforeEach(() => {
    // Unexpected errors are logged on purpose; keep test output quiet.
    vi.spyOn(filter['logger'], 'error').mockImplementation(() => undefined);
  });

  it('keeps the code, message, and details of an AppError', () => {
    const error = new AppError(
      ErrorCode.DAILY_ANALYSIS_LIMIT,
      HttpStatus.TOO_MANY_REQUESTS,
      'Limit reached.',
      {
        resetsAt: '2026-09-20T17:00:00Z',
      },
    );

    expect(filter.toErrorResponse(error)).toEqual({
      status: 429,
      body: {
        error: {
          code: 'DAILY_ANALYSIS_LIMIT',
          message: 'Limit reached.',
          details: { resetsAt: '2026-09-20T17:00:00Z' },
        },
      },
    });
  });

  it('gives framework errors a code from their status', () => {
    expect(
      filter.toErrorResponse(new NotFoundException('Cannot GET /v1/nothing')),
    ).toEqual({
      status: 404,
      body: { error: { code: 'NOT_FOUND', message: 'Cannot GET /v1/nothing' } },
    });
    expect(
      filter.toErrorResponse(
        new BadRequestException(['a is wrong', 'b is wrong']),
      ),
    ).toEqual({
      status: 400,
      body: {
        error: { code: 'BAD_REQUEST', message: 'a is wrong; b is wrong' },
      },
    });
  });

  it('reports rate limiting as RATE_LIMITED', () => {
    expect(
      filter.toErrorResponse(new ThrottlerException()).body.error.code,
    ).toBe('RATE_LIMITED');
  });

  it('reports unreadable request bodies without internal details', () => {
    const parseError = Object.assign(
      new SyntaxError('Unexpected token } in JSON at position 7'),
      {
        status: 400,
        type: 'entity.parse.failed',
      },
    );

    expect(filter.toErrorResponse(parseError)).toEqual({
      status: 400,
      body: {
        error: {
          code: 'BAD_REQUEST',
          message: 'The request body could not be read.',
        },
      },
    });
  });

  it('hides unexpected errors behind INTERNAL_ERROR with the request ID', () => {
    const response = runInRequestContext({ requestId: 'req-abcdef12' }, () =>
      filter.toErrorResponse(new Error('connection string postgres://secret')),
    );

    expect(response).toEqual({
      status: 500,
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred.',
          details: { requestId: 'req-abcdef12' },
        },
      },
    });
    expect(JSON.stringify(response)).not.toContain('secret');
  });

  it('treats a plain 503 from the framework as SERVICE_UNAVAILABLE', () => {
    const { status, body } = filter.toErrorResponse(
      new ServiceUnavailableException(),
    );
    expect(status).toBe(503);
    expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
  });
});
