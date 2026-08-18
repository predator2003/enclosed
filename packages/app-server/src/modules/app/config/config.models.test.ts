import { describe, expect, test } from 'vitest';
import { getPublicConfig, injectPublicConfigInIndex } from './config.models';
import { overrideConfig } from './config.test-utils';

describe('config models', () => {
  describe('injectPublicConfigInIndex', () => {
    const indexHtmlContent = '<html><head><title>a</title></head><body><script src="/app.js"></script></body></html>';

    test('the public config is injected as a non-executable json script block', () => {
      const result = injectPublicConfigInIndex({
        publicConfig: { viewNotePathPrefix: '/' } as any,
        indexHtmlContent,
      });

      expect(result).to.include('<script type="application/json" id="enclosed-config">{"viewNotePathPrefix":"/"}</script></head>');
    });

    test('a config value cannot close the script block early', () => {
      const result = injectPublicConfigInIndex({
        publicConfig: { viewNotePathPrefix: '</script><script>alert(1)</script>' } as any,
        indexHtmlContent,
      });

      expect(result).not.to.include('<script>alert(1)</script>');
      // The `<` of the injected value is escaped, so the block is not closed early
      expect(result).to.include('\\u003C/script>\\u003Cscript>');
    });

    test('replacement patterns in a config value are not expanded into the document', () => {
      // `$'` in a string replacement expands to the text following the match, which
      // would splice the document tail (including a literal </script>) into the block
      const result = injectPublicConfigInIndex({
        publicConfig: { viewNotePathPrefix: '$\'' } as any,
        indexHtmlContent,
      });

      expect(result).to.include('{"viewNotePathPrefix":"$\'"}');
      expect(result).not.to.include('$\'<body>');
    });
  });

  describe('getPublicConfig', () => {
    test('the public config exposes the payload limit but no secret', () => {
      const config = overrideConfig({
        authentication: { jwtSecret: 'super-secret', authUsers: [{ email: 'a@b.c', passwordHash: 'hash' }] },
      });

      const { publicConfig } = getPublicConfig({ config });

      expect(publicConfig.maxNotePayloadBytes).to.eql(config.notes.maxEncryptedPayloadLength);
      expect(JSON.stringify(publicConfig)).not.to.include('super-secret');
      expect(JSON.stringify(publicConfig)).not.to.include('hash');
    });
  });
});
