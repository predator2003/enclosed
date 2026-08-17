import type { BindableStorageFactory } from '../storage/storage.types';
import type { Config } from './config/config.types';
import type { ServerInstanceGenerics } from './server.types';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';
import { createNotePayloadTooLargeError } from '../notes/notes.errors';
import { registerNotesRoutes } from '../notes/notes.routes';
import { authenticationMiddleware } from './auth/auth.middleware';
import { registerAuthRoutes } from './auth/auth.routes';
import { registerConfigRoutes } from './config/config.routes';
import { createConfigMiddleware } from './middlewares/config.middleware';
import { corsMiddleware } from './middlewares/cors.middleware';
import { registerErrorMiddleware } from './middlewares/errors.middleware';
import { loggerMiddleware } from './middlewares/logger.middleware';
import { createStorageMiddleware } from './middlewares/storage.middleware';
import { timeoutMiddleware } from './middlewares/timeout.middleware';

export { createServer };

// The note payload limit is enforced per-route on the parsed body; the body limit guards
// the raw request stream so oversized bodies are rejected while streaming instead of being
// buffered into memory first. The envelope accounts for the JSON fields around the payload.
const BODY_ENVELOPE_OVERHEAD_BYTES = 1024 * 4;

// When the client bundle is served by this server but talks to an API on another origin
// (an absolute PUBLIC_BASE_API_URL), that origin must be allowed by connect-src.
function getConnectSources({ config }: { config?: Config }) {
  const sources = ['\'self\''];

  try {
    sources.push(new URL(config?.public.baseApiUrl ?? '/').origin);
  } catch {
    // Relative base API URL: same-origin, already covered by 'self'
  }

  return sources;
}

function createServer({ config, storageFactory }: { config?: Config; storageFactory: BindableStorageFactory }) {
  const app = new Hono<ServerInstanceGenerics>({ strict: true });

  app.use(loggerMiddleware);
  app.use(createConfigMiddleware({ config }));
  app.use(timeoutMiddleware);
  app.use(corsMiddleware);
  app.use(createStorageMiddleware({ storageFactory }));
  app.use(secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ['\'self\''],
      // The runtime config is injected as a non-executable JSON <script> block
      // (see injectPublicConfigInIndex), so inline script execution stays disallowed.
      scriptSrc: ['\'self\''],
      // The client relies on dynamically injected styles for theming.
      styleSrc: ['\'self\'', '\'unsafe-inline\''],
      imgSrc: ['\'self\'', 'data:'],
      connectSrc: getConnectSources({ config }),
      fontSrc: ['\'self\'', 'data:'],
      objectSrc: ['\'none\''],
      baseUri: ['\'self\''],
      frameAncestors: ['\'none\''],
      formAction: ['\'self\''],
    },
    permissionsPolicy: {
      camera: [],
      microphone: [],
      geolocation: [],
      payment: [],
      usb: [],
    },
  }));
  // The limit is resolved per request so deployments that only provide config through
  // the environment (e.g. Cloudflare, where createServer receives no config object)
  // still honor NOTES_MAX_ENCRYPTED_PAYLOAD_LENGTH.
  app.use(async (context, next) => {
    const maxSize = context.get('config').notes.maxEncryptedPayloadLength + BODY_ENVELOPE_OVERHEAD_BYTES;

    return bodyLimit({
      maxSize,
      onError: () => {
        throw createNotePayloadTooLargeError();
      },
    })(context, next);
  });
  app.use(authenticationMiddleware);

  registerErrorMiddleware({ app });

  registerAuthRoutes({ app });
  registerConfigRoutes({ app });
  registerNotesRoutes({ app });

  app.get('/api/ping', context => context.json({ status: 'ok' }));

  return {
    app,
  };
}
