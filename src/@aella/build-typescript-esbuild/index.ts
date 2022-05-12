import { build } from './build.js';
import { extractDependencies } from './extract-dependencies.js';
export { build, extractDependencies };

import type { Plugin } from '@aella/core';

export const plugin: Plugin = (ctx) => {
  ctx.onWorkspaceConfig((config, S) => {
    config.builders.push({
      build,
      extractDependencies,
      name: '@aella/build-typescript-esbuild',
    });

    config.schemas.project.buildSchemas.push(S.string().enum(['@aella/build-typescript-esbuild']));
  });
};
