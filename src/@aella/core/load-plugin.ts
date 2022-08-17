import path from 'node:path';
import resolve from 'resolve';

import type { Plugin, WorkspaceConfig } from './types';

import { build } from './build.js';
import { loadProject } from './load-project.js';
import { findProjectNameFromFilePath } from './find-project.js';

export async function loadPlugin(workspace: WorkspaceConfig, pluginPath: string): Promise<Plugin | string | undefined> {
  const resolvedPluginPath = await new Promise<string | void>((res) => {
    resolve(
      pluginPath,
      {
        basedir: process.cwd(),
        extensions: ['.js', '.ts'],
      },
      (err, resolved, _pkg) => {
        if (err) {
          res();
        } else if (resolved) {
          res(resolved);
        }
      }
    );
  });

  if (resolvedPluginPath) {
    if (resolvedPluginPath.endsWith('.js')) {
      const raw = await import(resolvedPluginPath);
      if (raw && raw.default) {
        return raw.default;
      }
    }

    if (resolvedPluginPath.endsWith('.ts')) {
      const projectName = await findProjectNameFromFilePath(workspace, resolvedPluginPath);
      if (projectName) {
        const project = loadProject(workspace, projectName);
        if (!workspace.getBuilder(project)) {
          return resolvedPluginPath;
        }

        await build(workspace, { project });
        const raw = await import(path.join(project.distDir, 'index.js'));
        if (raw && raw.default) {
          return raw.default;
        }
      }
    }
  }

  return undefined;
}
