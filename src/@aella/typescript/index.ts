import { buildTarget } from './build-target.js';
import { buildProject } from './build-project.js';
import { extractDependencies } from './extract-dependencies.js';
export { buildProject, buildTarget, extractDependencies };

import type { Plugin } from '@aella/core';

export const plugin: Plugin = (ctx) => {
  ctx.onWorkspaceConfig((config) => {
    config.builders.push({
      buildProject,
      buildTarget,
      extractDependencies,
      name: '@aella/typescript',
    });
  });
};
