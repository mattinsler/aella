import fs from 'fs';
import path from 'path';

import type { ProjectConfig, TargetConfig, WorkspaceConfig } from './types.js';

export async function copyAssets({ project, workspace }: { project: ProjectConfig; workspace: WorkspaceConfig }) {
  const assets = Array.from(new Set([...project.targets.values()].flatMap((target) => target.assets)));

  const copies = assets.map((asset) => [
    path.join(project.rootDir, asset),
    path.join(workspace.distDir, path.relative(workspace.rootDir, project.rootDir), asset),
  ]);

  await Promise.all(copies.map(([from, to]) => fs.promises.copyFile(from, to)));

  return copies.map((c) => c[1].slice(workspace.rootDir.length + 1));
}

export async function copyTargetAssetsTo({
  target,
  toDir,
  workspace,
}: {
  target: TargetConfig;
  toDir: string;
  workspace: WorkspaceConfig;
}) {
  const { project } = target;
  const assets = Array.from(new Set(target.assets));

  const copies = assets.map((asset) => [
    path.join(project.rootDir, asset),
    path.join(toDir, path.relative(workspace.rootDir, project.rootDir), asset),
  ]);

  await Promise.all(copies.map(([from, to]) => fs.promises.copyFile(from, to)));

  return copies.map((c) => c[1].slice(toDir.length + 1));
}
