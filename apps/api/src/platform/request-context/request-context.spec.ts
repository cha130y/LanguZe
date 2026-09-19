import {
  currentRequestId,
  resolveRequestId,
  runInRequestContext,
} from './request-context.js';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('resolveRequestId', () => {
  it('reuses a well-formed incoming ID, such as one set by a proxy', () => {
    expect(resolveRequestId('a1b2c3d4-e5f6')).toBe('a1b2c3d4-e5f6');
  });

  it.each([
    ['missing', undefined],
    ['too short', 'abc'],
    ['too long', 'a'.repeat(65)],
    ['containing a line break', 'abcdefgh\nfake log line'],
    ['containing spaces', 'abcd efgh'],
    ['repeated', ['abcdefgh', 'ijklmnop']],
  ])('creates a new ID when the incoming one is %s', (_label, incoming) => {
    expect(resolveRequestId(incoming)).toMatch(UUID);
  });
});

describe('runInRequestContext', () => {
  it('makes the request ID available inside the callback only', () => {
    expect(currentRequestId()).toBeUndefined();
    const seen = runInRequestContext({ requestId: 'req-12345678' }, () =>
      currentRequestId(),
    );
    expect(seen).toBe('req-12345678');
    expect(currentRequestId()).toBeUndefined();
  });

  it('runs the callback without a context when none is given', () => {
    expect(
      runInRequestContext(undefined, () => currentRequestId()),
    ).toBeUndefined();
  });
});
