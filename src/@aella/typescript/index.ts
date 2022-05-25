// import { buildTarget } from './build-target.js';
// import { buildProject } from './build-project.js';
// import { extractDependencies } from './extract-dependencies.js';
// export { buildProject, buildTarget, extractDependencies };

import type { Plugin } from '@aella/core';

export const plugin: Plugin = (ctx) => {
  ctx.onWorkspaceConfig((config) => {
    config.builders.push({
      buildProject: async (...args) => (await import('./build-project.js')).buildProject(...args),
      buildTarget: async (...args) => (await import('./build-target.js')).buildTarget(...args),
      extractDependencies: async (...args) => (await import('./extract-dependencies.js')).extractDependencies(...args),
      name: '@aella/typescript',
    });
  });
};
