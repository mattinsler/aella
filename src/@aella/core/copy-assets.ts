import fs from 'fs';
import path from 'path';

import type { ProjectConfig } from './types.js';

export async function copyAssets({
  files,
  project,
}: {
  files: { assets: string[]; sources: string[] };
  project: ProjectConfig;
}) {
  const { workspace } = project;

  const copies = files.assets.map((asset) => ({
    from: path.join(project.rootDir, asset),
    to: path.join(workspace.distDir, path.relative(workspace.rootDir, project.rootDir), asset),
  }));

  await Promise.all(
    Array.from(new Set(copies.map(({ to }) => path.dirname(to)))).map((dir) =>
      fs.promises.mkdir(dir, { recursive: true })
    )
  );
  await Promise.all(copies.map(({ from, to }) => fs.promises.copyFile(from, to)));

  return {
    inputs: files.assets,
    outputs: files.assets,
  };
}
