import type { WorkspaceConfig } from './types.js';

import { createGlob } from './glob.js';

export interface ProjectResolver {
  resolveAll(): Promise<string[]>;
}

export function createFdirProjectResolver(workspace: WorkspaceConfig): ProjectResolver {
  const rootDir = workspace.rootDir.replace(/\/+$/, '');
  const glob = createGlob(
    { filename: workspace.project.config.filename },
    {
      exclude: workspace.project.ignore,
    }
  );

  return {
    async resolveAll() {
      return glob(rootDir);
    },
  };
}
