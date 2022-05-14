import { build } from './build.js';
import { extractDependencies } from './extract-dependencies.js';
export { build, extractDependencies };

import type { Plugin } from '@aella/core';

export const plugin: Plugin = (ctx) => {
  ctx.onWorkspaceConfig((config) => {
    config.builders.push({
      build,
      extractDependencies,
      name: '@aella/build-typescript-esbuild',
    });
  });
};
