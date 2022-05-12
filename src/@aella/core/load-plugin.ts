import path from 'node:path';
import resolve from 'resolve';

import type { Plugin, WorkspaceConfig } from './types';

import { loadProject } from './load-project.js';
import { build, builderForProject } from './build.js';
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
      if (raw && raw.plugin) {
        return raw.plugin;
      }
    }

    if (resolvedPluginPath.endsWith('.ts')) {
      const projectName = await findProjectNameFromFilePath(workspace, resolvedPluginPath);
      if (projectName) {
        const project = loadProject(workspace, projectName);
        try {
          builderForProject(project);
        } catch (err) {
          return resolvedPluginPath;
        }

        await build(project, { deps: true });
        const raw = await import(path.join(project.distDir, 'index.js'));
        if (raw && raw.plugin) {
          return raw.plugin;
        }
      }
    }
  }

  return undefined;
}
