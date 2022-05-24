import { deploy } from './deploy.js';
export { deploy };

import type { Plugin } from '@aella/core';

export const plugin: Plugin = (ctx) => {
  ctx.onWorkspaceConfig((config, S) => {
    config.deployers.push({
      deploy,
      name: '@aella/docker',
      configSchema: S.object().prop('repository', S.string()).prop('registry', S.string()),
    });
  });
};
