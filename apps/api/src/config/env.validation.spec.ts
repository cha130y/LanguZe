import { NodeEnv, validateEnv } from './env.validation.js';

const DATABASE_URL = 'postgresql://languze:secret@localhost:5435/languze';

describe('validateEnv', () => {
  it('applies defaults when only DATABASE_URL is provided', () => {
    const env = validateEnv({ DATABASE_URL });

    expect(env.NODE_ENV).toBe(NodeEnv.Development);
    expect(env.PORT).toBe(4001);
    expect(env.WEB_ORIGIN).toBe('http://localhost:3003');
  });

  it('converts PORT from its string form', () => {
    expect(validateEnv({ DATABASE_URL, PORT: '8080' }).PORT).toBe(8080);
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('rejects a non-PostgreSQL DATABASE_URL', () => {
    expect(() =>
      validateEnv({ DATABASE_URL: 'mysql://user@localhost/db' }),
    ).toThrow(/DATABASE_URL/);
  });

  it('rejects an out-of-range PORT', () => {
    expect(() => validateEnv({ DATABASE_URL, PORT: '70000' })).toThrow(/PORT/);
  });

  it('does not leak variable values in the error message', () => {
    expect(() => validateEnv({ DATABASE_URL: 'not-a-url-secret' })).toThrow(
      /^Invalid environment variables: DATABASE_URL$/,
    );
  });
});
