import { describe, expect, it } from 'vite-plus/test';
import { validateEnvironment } from './env.js';

const valid = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/core',
  BETTER_AUTH_SECRET: 'test-secret-with-at-least-thirty-two-characters',
  BETTER_AUTH_URL: 'http://localhost:43127',
};

describe('environment validation', () => {
  it('loads typed defaults and a comma-separated origin allowlist', () => {
    const env = validateEnvironment({
      ...valid,
      BETTER_AUTH_TRUSTED_ORIGINS: 'https://example.com, https://app.example.com',
    });
    expect(env.APP_PORT).toBe(43127);
    expect(env.SWAGGER_ENABLED).toBe(false);
    expect(env.BETTER_AUTH_TRUSTED_ORIGINS).toEqual([
      'https://example.com',
      'https://app.example.com',
    ]);
  });

  it.each(['0', '65536', 'abc', ''])('rejects invalid application port %s', (APP_PORT) => {
    expect(() => validateEnvironment({ ...valid, APP_PORT })).toThrow();
  });

  it.each(['DATABASE_URL', 'BETTER_AUTH_SECRET', 'BETTER_AUTH_URL'])(
    'rejects missing %s',
    (key) => {
      expect(() => validateEnvironment({ ...valid, [key]: undefined })).toThrow();
    },
  );

  it('does not expose secrets in configuration errors', () => {
    expect(() =>
      validateEnvironment({
        ...valid,
        BETTER_AUTH_SECRET: 'private-value',
        DATABASE_URL: 'private-database-password',
      }),
    ).toThrow('Invalid environment:');
    try {
      validateEnvironment({ ...valid, BETTER_AUTH_SECRET: 'private-value' });
    } catch (error) {
      expect(String(error)).not.toContain('private-value');
    }
  });

  it('parses false explicitly and rejects malformed booleans and origins', () => {
    expect(validateEnvironment({ ...valid, SWAGGER_ENABLED: 'false' }).SWAGGER_ENABLED).toBe(false);
    expect(() => validateEnvironment({ ...valid, SWAGGER_ENABLED: 'yes' })).toThrow();
    expect(() => validateEnvironment({ ...valid, BETTER_AUTH_TRUSTED_ORIGINS: '*' })).toThrow();
  });
});
