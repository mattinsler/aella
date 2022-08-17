import fs from 'node:fs';
import memo from 'memoizee';
import path from 'node:path';
import S from 'fluent-json-schema';
import { parse } from 'jsonc-parser';

import type { Builder, Bundler, Plugin, PluginContext, WorkspaceConfig } from './types';

import { loadPlugin } from './load-plugin.js';
import { findWorkspaceConfigPath } from './find-workspace.js';
import { Project, Target, Workspace } from './json-schema.js';
import { generateJsonSchema } from './generate-json-schema.js';

export function createWorkspaceConfig(rootDir: string): WorkspaceConfig {
  rootDir = path.resolve(rootDir);

  const builders = new Map<string, Builder>();
  const bundlers = new Map<string, Bundler>();

  return {
    addBuilder(builder) {
      if (builders.has(builder.name)) {
        throw new Error();
      }
      builders.set(builder.name, builder);
    },
    addBundler(bundler) {
      if (bundlers.has(bundler.name)) {
        throw new Error();
      }
      bundlers.set(bundler.name, bundler);
    },

    // @ts-expect-error
    getBuilder(projectOrName, throwOnMissing) {
      const builder =
        typeof projectOrName === 'string' ? builders.get(projectOrName) : builders.get(projectOrName.build.type);

      if (!builder && throwOnMissing) {
        throw new Error(
          typeof projectOrName === 'string'
            ? `No builder named ${projectOrName} exists.`
            : `Project ${projectOrName.name} does not have a valid builder configured.`
        );
      }

      return builder;
    },

    // @ts-expect-error
    getBundler(targetOrName, throwOnMissing) {
      const bundler =
        typeof targetOrName === 'string' ? bundlers.get(targetOrName) : bundlers.get(targetOrName.bundle.type);

      if (!bundler && throwOnMissing) {
        throw new Error(
          typeof targetOrName === 'string'
            ? `No bundler named ${targetOrName} exists.`
            : `Target ${targetOrName.project.name}:${targetOrName.name} does not have a valid bundler configured.`
        );
      }

      return bundler;
    },

    get allBuilders() {
      return Array.from(builders.values());
    },
    get allBundlers() {
      return Array.from(bundlers.values());
    },

    commands: [],
    defaults: {
      build: {},
      bundle: {},
    },
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

function parseJsoncFile(file: string) {
  const content = (fs.existsSync(file) && fs.readFileSync(file, 'utf-8')) || '{}';
  return parse(content);
}

const loadWorkspaceFromFile = memo(
  async function loadWorkspaceFromFile(file: string): Promise<WorkspaceConfig> {
    const originalConfig = parseJsoncFile(file);

    const plugins: Plugin[] = [];

    const pluginHooks: WorkspaceConfig['pluginHooks'] = {
      onProjectConfig: [],
      onTargetConfig: [],
      onWorkspaceConfig: [],
    };

    const rootDir = path.dirname(file);

    const res = createWorkspaceConfig(rootDir);
    res.originalConfig = originalConfig;
    if (originalConfig.distDir) {
      res.distDir = originalConfig.distDir;
    }
    if (originalConfig.project?.config?.filename) {
      res.project.config.filename = originalConfig.project.config.filename;
    }
    res.plugins = plugins;
    res.pluginHooks = pluginHooks;

    const pluginsToRetry: string[] = [];
    const pluginContext: PluginContext = {
      onProjectConfig: (fn) => pluginHooks.onProjectConfig.push(fn),
      onTargetConfig: (fn) => pluginHooks.onTargetConfig.push(fn),
      onWorkspaceConfig: (fn) => {
        pluginHooks.onWorkspaceConfig.push(fn);
        fn(res, S);
      },
    };

    for (const pluginPath of originalConfig.plugins || []) {
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

    const config = Workspace.validate(res, originalConfig);

    if (!config.valid) {
      throw new Error(`Could not validate workspace config file at ${file}: ${config.errors}.`);
    }

    if (config.value.defaults) {
      res.defaults.build = { ...config.value.defaults.build };
      res.defaults.bundle = { ...config.value.defaults.bundle };
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
