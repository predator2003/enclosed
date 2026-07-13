import type { Config } from './config.types';
import { get } from 'lodash-es';
import { buildTimeConfig } from './config.constants';

export {
  getConfig,
};

function getRuntimeConfig(): Partial<Config> {
  // The server injects the runtime config as a non-executable JSON script block,
  // which keeps the CSP free of 'unsafe-inline' for scripts.
  const configElement = document.getElementById('enclosed-config');

  if (configElement?.textContent) {
    try {
      return JSON.parse(configElement.textContent);
    } catch {
      // Malformed injected config: fall back to the legacy global below.
    }
  }

  return get(window, '__CONFIG__', {});
}

function getConfig(): Config {
  const runtimeConfig: Partial<Config> = getRuntimeConfig();

  const config: Config = {
    ...buildTimeConfig,
    ...runtimeConfig,
  };

  return config;
}
