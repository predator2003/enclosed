import { describe, expect, test } from 'vitest';
import { DEFAULT_JWT_SECRET, getConfig } from './config';

describe('config', () => {
  describe('default jwt secret guard', () => {
    test('an instance that requires authentication refuses to build a config with the default jwt secret', () => {
      // Enforced in getConfig (not in an entrypoint) so every runtime is covered,
      // including the Cloudflare worker which resolves the config per request
      expect(() => getConfig({
        env: {
          PUBLIC_IS_AUTHENTICATION_REQUIRED: 'true',
          AUTHENTICATION_JWT_SECRET: DEFAULT_JWT_SECRET,
        },
      })).to.throw(/AUTHENTICATION_JWT_SECRET is still the default value/);
    });

    test('the same instance builds fine with a real secret', () => {
      const config = getConfig({
        env: {
          PUBLIC_IS_AUTHENTICATION_REQUIRED: 'true',
          AUTHENTICATION_JWT_SECRET: 'a-real-secret',
        },
      });

      expect(config.authentication.jwtSecret).to.eql('a-real-secret');
    });

    test('a public instance without authentication is unaffected by the default secret', () => {
      const config = getConfig({ env: { PUBLIC_IS_AUTHENTICATION_REQUIRED: 'false' } });

      expect(config.authentication.jwtSecret).to.eql(DEFAULT_JWT_SECRET);
    });
  });
});
