import type { ServerInstance } from '../server.types';
import { getPublicConfig } from './config.models';

export { registerConfigRoutes };

function registerConfigRoutes({ app }: { app: ServerInstance }) {
  setupGetPublicConfigRoute({ app });
}

function setupGetPublicConfigRoute({ app }: { app: ServerInstance }) {
  app.get('/api/config', async (context) => {
    const config = context.get('config');
    const { publicConfig } = getPublicConfig({ config });

    return context.json({
      config: publicConfig,
    });
  });
}
