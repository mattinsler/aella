import fs from 'node:fs';
import memo from 'memoizee';
import path from 'node:path';
import { parse } from 'jsonc-parser';
import { createRequire } from 'node:module';

import type { Plugin, WorkspaceConfig } from './types';

import { findWorkspaceConfigPath } from './find-workspace.js';
import { generateJsonSchema } from './generate-json-schema.js';
import { Project, Target, Workspace } from './json-schema.js';

export function createEmptyWorkspaceConfig(rootDir: string): WorkspaceConfig {
  return {
    builders: [],
    commands: [],
    deployers: [],
    distDir: path.join(rootDir, 'dist'),
    metaDir: path.join(rootDir, '.aella'),
    originalConfig: {},
    plugins: [],
    pluginHooks: {
      onProjectConfig: [],
      onTargetConfig: [],
      onWorkspaceConfig: [],
    },
    project: {
      config: {
        filename: 'project.json',
      },
    },
    rootDir,
    schemas: {
      project: Project,
      target: Target,
      workspace: Workspace,
    },
  };
}

const loadWorkspaceFromFile = memo(
  async function loadWorkspaceFromFile(file: string): Promise<WorkspaceConfig> {
    const originalConfig = parse(fs.readFileSync(file, 'utf-8'));
    const config = Workspace.validate(originalConfig);

    if (!config.valid) {
      throw new Error(`Could not validate workspace config file at ${file}: ${config.errors}.`);
    }

    const plugins: Plugin[] = (
      await Promise.all(
        (config.value.plugins || []).map(async (p: string) => {
          const raw = await import(createRequire(path.join(process.cwd(), 'noop.js')).resolve(p));
          if (raw && raw.plugin) {
            return raw.plugin;
          }
        })
      )
    ).filter(Boolean);

    const pluginHooks: WorkspaceConfig['pluginHooks'] = {
      onProjectConfig: [],
      onTargetConfig: [],
      onWorkspaceConfig: [],
    };

    for (const plugin of plugins) {
      plugin({
        onProjectConfig: (fn) => pluginHooks.onProjectConfig.push(fn),
        onTargetConfig: (fn) => pluginHooks.onTargetConfig.push(fn),
        onWorkspaceConfig: (fn) => pluginHooks.onWorkspaceConfig.push(fn),
      });
    }

    const rootDir = path.dirname(file);

    const res: WorkspaceConfig = {
      builders: [],
      commands: [],
      deployers: [],
      distDir: config.value.distDir || path.join(rootDir, 'dist'),
      metaDir: path.join(rootDir, '.aella'),
      originalConfig,
      plugins,
      pluginHooks,
      project: {
        config: {
          filename: config.value.project?.config?.filename || 'project.json',
        },
      },
      rootDir,
      schemas: {
        project: Project,
        target: Target,
        workspace: Workspace,
      },
    };

    pluginHooks.onWorkspaceConfig.forEach((p) => p(res, res.originalConfig));

    generateJsonSchema(res);

    return res;
  },
  { promise: true }
);

export function loadWorkspace(fileOrDirPath: string = process.cwd()): Promise<WorkspaceConfig> {
  const configFile = findWorkspaceConfigPath(fileOrDirPath);
  return loadWorkspaceFromFile(configFile);
}
