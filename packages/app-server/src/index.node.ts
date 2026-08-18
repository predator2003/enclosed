import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer as createHttpsServer } from 'node:https';
import process, { env } from 'node:process';
import { safelySync } from '@corentinth/chisels';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { memoize } from 'lodash-es';
import { DEFAULT_JWT_SECRET, getConfig } from './modules/app/config/config';
import { getPublicConfig, injectPublicConfigInIndex } from './modules/app/config/config.models';
import { createServer } from './modules/app/server';
import { deleteExpiredNotesTask } from './modules/notes/tasks/delete-expired-notes.tasks';
import { createLogger } from './modules/shared/logger/logger';
import { createFsLiteStorage } from './modules/storage/factories/fs-lite.storage';
import { createTaskScheduler } from './modules/tasks/task-scheduler';

const logger = createLogger({ namespace: 'app-server' });

// Docker/Kubernetes secrets are usually mounted as files; the _FILE variants let
// operators keep secrets out of the environment (upstream issue #426). The file
// content only fills the variable when the direct variable is not already set.
for (const name of ['AUTHENTICATION_JWT_SECRET', 'AUTHENTICATION_USERS']) {
  const filePath = env[`${name}_FILE`];

  if (filePath && !env[name]) {
    const [content, readError] = safelySync(() => readFileSync(filePath, 'utf-8').trim());

    if (readError) {
      logger.error({ error: readError, filePath }, `Cannot read ${name}_FILE`);
      process.exit(1);
    }

    // An empty file would silently fall back to the config default (for the JWT
    // secret: the publicly known placeholder), so refuse it instead.
    if (!content) {
      logger.error({ filePath }, `${name}_FILE is empty`);
      process.exit(1);
    }

    env[name] = content;
  }
}

const [config, configError] = safelySync(() => getConfig({ env }));

if (configError) {
  logger.error({ error: configError }, `Invalid config: ${configError.message}`);
  process.exit(1);
}

// getConfig already refuses the default JWT secret when authentication is required
// (https://github.com/CorentinTh/enclosed/issues/445); warn about the weaker case
// where users are configured but authentication is not switched on yet.
if (config.authentication.jwtSecret === DEFAULT_JWT_SECRET && config.authentication.authUsers.length > 0) {
  logger.warn('AUTHENTICATION_USERS is configured but AUTHENTICATION_JWT_SECRET is still the default value. Set a strong secret before enabling authentication.');
}

const { storage } = createFsLiteStorage({ config });

const { app } = createServer({ config, storageFactory: () => ({ storage }) });

const getIndexContent = memoize(async () => {
  const index = await readFile('public/index.html', 'utf-8');

  return index;
});

app
  .use(
    '*',
    serveStatic({
      root: 'public',
      index: 'unexisting-file', // Disable index.html fallback to let the next middleware handle it
    }),
  )
  .use(
    '*',
    async (context, next) => {
      if (context.req.path.includes('/api/')) {
        return next();
      }

      const { publicConfig } = getPublicConfig({ config: context.get('config') });

      const indexHtmlContent = await getIndexContent();
      const indexWithConfig = injectPublicConfigInIndex({ publicConfig, indexHtmlContent });

      return context.html(indexWithConfig);
    },
  );

const taskScheduler = createTaskScheduler({
  config,
  taskDefinitions: [
    deleteExpiredNotesTask,
  ],
  tasksArgs: { storage },
});

taskScheduler.start();

const server = serve(
  {
    fetch: app.fetch,
    port: config.server.port,
    ...(config.server.useHttps
      ? {
          createServer: createHttpsServer,
          serverOptions: config.server.https,
        }
      : {}),
  },
  ({ port }) => logger.info({ port }, 'Server started'),
);

process.on('SIGINT', async () => {
  await storage.dispose();
  server.close();

  process.exit(0);
});
