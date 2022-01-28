import fs from 'fs';
import path from 'path';

import type { ProjectConfig, WorkspaceConfig } from '../../types.js';

export async function ensureTsconfig({ project, workspace }: { project: ProjectConfig; workspace: WorkspaceConfig }) {
  const tsconfig = path.join(project.rootDir, 'tsconfig.json');

  if (!fs.statSync(tsconfig, { throwIfNoEntry: false })) {
    await fs.promises.writeFile(
      tsconfig,
      JSON.stringify(
        { extends: path.join(path.relative(project.rootDir, workspace.rootDir), 'tsconfig.base.json') },
        null,
        2
      ),
      'utf-8'
    );
  }
}
