import type { Config } from './config.types';

export { injectPublicConfigInIndex };

function injectPublicConfigInIndex({ publicConfig, indexHtmlContent }: { publicConfig: Config['public']; indexHtmlContent: string }) {
  // The config is embedded as a non-executable JSON script block so the CSP can keep
  // script-src restricted to 'self' (an inline executable script would require
  // 'unsafe-inline' or a nonce). `<` is escaped so no config value can close the
  // script element early.
  const serializedConfig = JSON.stringify(publicConfig).replace(/</g, '\\u003C');

  return indexHtmlContent.replace('</head>', `<script type="application/json" id="enclosed-config">${serializedConfig}</script></head>`);
}
