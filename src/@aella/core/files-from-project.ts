import fs from 'node:fs';
import path from 'node:path';
import memo from 'memoizee';

import type { ProjectConfig } from './types';

import { GlobOptions, glob } from './glob.js';

function createGlobber(project: ProjectConfig, options: GlobOptions) {
  const globber = glob(project.rootDir, options);

  globber.exclude((_dirName, dirPath) => fs.existsSync(path.join(dirPath, project.workspace.project.config.filename)));

  return globber;
}

export const filesFromProject = memo(
  async function (project: ProjectConfig): Promise<{ assets: string[]; sources: string[] }> {
    const assetsGlobber = createGlobber(project, project.files.assets);
    const sourcesGlobber = createGlobber(project, project.files.sources);

    const [assets, sources] = await Promise.all([
      assetsGlobber.async({ relative: true }),
      sourcesGlobber.async({ relative: true }),
    ]);

    const assetsSet = new Set(assets);
    sources.forEach((file) => assetsSet.delete(file));

    return {
      assets: Array.from(assetsSet),
      sources,
    };
  },
  { promise: true }
);
