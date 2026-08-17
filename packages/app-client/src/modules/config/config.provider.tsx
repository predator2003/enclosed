import type { Config } from './config.types';
import { safelySync } from '@corentinth/chisels';
import { buildTimeConfig } from './config.constants';

export {
  getConfig,
};

function getRuntimeConfig(): Partial<Config> {
  // The server injects the runtime config as a non-executable JSON script block,
  // which keeps the CSP free of 'unsafe-inline' for scripts.
  const configElement = document.getElementById('enclosed-config');

  if (!configElement?.textContent) {
    return {};
  }

  const [runtimeConfig] = safelySync(() => JSON.parse(configElement.textContent!));

  return runtimeConfig ?? {};
}

function getConfig(): Config {
  const runtimeConfig: Partial<Config> = getRuntimeConfig();

  const config: Config = {
    ...buildTimeConfig,
    ...runtimeConfig,
  };

  return config;
}
