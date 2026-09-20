import { NodeEnv, validateEnv } from './env.validation.js';

const DATABASE_URL = 'postgresql://languze:secret@localhost:5435/languze';
// Any 32-character value passes validation; this one is obviously not a real secret.
const AUTH_SECRET = 'test-secret-test-secret-test-sec';
const required = { DATABASE_URL, AUTH_SECRET };

describe('validateEnv', () => {
  it('applies defaults when only the required variables are provided', () => {
    const env = validateEnv({ ...required });

    expect(env.NODE_ENV).toBe(NodeEnv.Development);
    expect(env.PORT).toBe(4001);
    expect(env.WEB_ORIGIN).toBe('http://localhost:3003');
  });

  it('converts PORT from its string form', () => {
    expect(validateEnv({ ...required, PORT: '8080' }).PORT).toBe(8080);
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('rejects a non-PostgreSQL DATABASE_URL', () => {
    expect(() =>
      validateEnv({ ...required, DATABASE_URL: 'mysql://user@localhost/db' }),
    ).toThrow(/DATABASE_URL/);
  });

  it('rejects an out-of-range PORT', () => {
    expect(() => validateEnv({ ...required, PORT: '70000' })).toThrow(/PORT/);
  });

  it('applies the SRS usage limits and the default rate limit', () => {
    const env = validateEnv({ ...required });

    expect(env.WORLD_LIMIT).toBe(20);
    expect(env.DAILY_ANALYSIS_LIMIT).toBe(10);
    expect(env.DAILY_TUTOR_MESSAGE_LIMIT).toBe(30);
    expect(env.RATE_LIMIT_PER_MINUTE).toBe(120);
  });

  it('lets each environment change the usage limits', () => {
    const env = validateEnv({
      ...required,
      DAILY_ANALYSIS_LIMIT: '3',
      WORLD_LIMIT: '5',
    });

    expect(env.DAILY_ANALYSIS_LIMIT).toBe(3);
    expect(env.WORLD_LIMIT).toBe(5);
  });

  it.each(['0', '-1', '2.5', 'many'])(
    'rejects a daily analysis limit of %s',
    (value) => {
      expect(() =>
        validateEnv({ ...required, DAILY_ANALYSIS_LIMIT: value }),
      ).toThrow(/DAILY_ANALYSIS_LIMIT/);
    },
  );

  it('does not leak variable values in the error message', () => {
    expect(() =>
      validateEnv({ ...required, DATABASE_URL: 'not-a-url-secret' }),
    ).toThrow(/^Invalid environment variables: DATABASE_URL$/);
  });

  it('requires a long AUTH_SECRET', () => {
    expect(() => validateEnv({ DATABASE_URL })).toThrow(/AUTH_SECRET/);
    expect(() =>
      validateEnv({ DATABASE_URL, AUTH_SECRET: 'too short' }),
    ).toThrow(/AUTH_SECRET/);
  });
});
