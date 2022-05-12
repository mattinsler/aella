import fs from 'node:fs';
import memo from 'memoizee';
import path from 'node:path';
import S from 'fluent-json-schema';
import { parse } from 'jsonc-parser';

import type { Plugin, PluginContext, WorkspaceConfig } from './types';

import { loadPlugin } from './load-plugin.js';
import { findWorkspaceConfigPath } from './find-workspace.js';
import { Project, Target, Workspace } from './json-schema.js';
import { generateJsonSchema } from './generate-json-schema.js';

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

    const plugins: Plugin[] = [];

    const pluginHooks: WorkspaceConfig['pluginHooks'] = {
      onProjectConfig: [],
      onTargetConfig: [],
      onWorkspaceConfig: [],
    };

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

    const pluginsToRetry: string[] = [];
    const pluginContext: PluginContext = {
      onProjectConfig: (fn) => pluginHooks.onProjectConfig.push(fn),
      onTargetConfig: (fn) => pluginHooks.onTargetConfig.push(fn),
      onWorkspaceConfig: (fn) => {
        pluginHooks.onWorkspaceConfig.push(fn);
        fn(res, S);
      },
    };

    for (const pluginPath of config.value.plugins || []) {
      const plugin = await loadPlugin(res, pluginPath);
      if (plugin) {
        if (typeof plugin === 'string') {
          pluginsToRetry.push(plugin);
        } else {
          plugins.push(plugin);
          plugin(pluginContext);
        }
      }
    }

    for (const pluginPath of pluginsToRetry) {
      const plugin = await loadPlugin(res, pluginPath);
      if (plugin && typeof plugin !== 'string') {
        plugins.push(plugin);
        plugin(pluginContext);
      }
    }

    generateJsonSchema(res);

    return res;
  },
  { promise: true }
);

export function loadWorkspace(fileOrDirPath: string = process.cwd()): Promise<WorkspaceConfig> {
  const configFile = findWorkspaceConfigPath(fileOrDirPath);
  return loadWorkspaceFromFile(configFile);
}
