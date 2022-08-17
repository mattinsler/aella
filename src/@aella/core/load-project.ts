import fs from 'node:fs';
import memo from 'memoizee';
import path from 'node:path';
import { parse } from 'jsonc-parser';

import type { BuildOptionsConfig, Glob, ProjectConfig, WorkspaceConfig } from './types';

import { loadTarget } from './load-target.js';
import { findProjectConfigPath } from './find-project.js';
import { BuildSchema, Project, ProjectSchema } from './json-schema.js';

// export const BASE_SCHEMA = joi.object({
//   assets: joi.alternatives(
//     joi.array().items(joi.string()),
//     joi.object({
//       exclude: joi.object({
//         directories: joi.array().items(joi.string()),
//         files: joi.array().items(joi.string()),
//       }),
//       include: joi.object({
//         directories: joi.array().items(joi.string()),
//         files: joi.array().items(joi.string()),
//       }),
//     })
//   ),
//   builder: joi.string(),
//   dependencies: joi.object({
//     build: joi.array().items(joi.string()),
//     lint: joi.array().items(joi.string()),
//   }),
//   srcs: joi.alternatives(
//     joi.array().items(joi.string()),
//     joi.object({
//       exclude: joi.object({
//         directories: joi.array().items(joi.string()),
//         files: joi.array().items(joi.string()),
//       }),
//       include: joi.object({
//         directories: joi.array().items(joi.string()),
//         files: joi.array().items(joi.string()),
//       }),
//     })
//   ),
//   targets: joi
//     .object()
//     .pattern(/./, joi.any())
//     .description(
//       'This is an object of target configurations. The key is the name of the target within this project. For instance, `{ targets: { foo: { /* ... */ } } }` will denote a target named `foo` within this project. If the target name matches the project directory, it will be considered the default target for the project.'
//     ),
// });

const DEFAULT_SRCS_INCLUDE_FILES = ['**/*'];
const DEFAULT_SRCS_EXCLUDE_DIRECTORIES = ['.git', 'node_modules', '__generated__'];
const DEFAULT_ASSETS_INCLUDE_FILES: string[] = [];
const DEFAULT_ASSETS_EXCLUDE_DIRECTORIES = ['.git', 'node_modules', '__generated__'];

function parseAssetsGlob(assets?: string[] | Partial<Glob>): Glob {
  if (!assets) {
    return {
      exclude: {
        directories: DEFAULT_ASSETS_EXCLUDE_DIRECTORIES,
      },
      include: {
        files: DEFAULT_ASSETS_INCLUDE_FILES,
      },
    };
  }

  if (Array.isArray(assets)) {
    return {
      exclude: {
        directories: DEFAULT_ASSETS_EXCLUDE_DIRECTORIES,
      },
      include: {
        files: assets,
      },
    };
  }

  return {
    exclude: {
      ...assets.exclude,
      directories:
        assets.exclude && assets.exclude.directories ? assets.exclude.directories : DEFAULT_ASSETS_EXCLUDE_DIRECTORIES,
    },
    include: {
      ...assets.include,
      files: assets.include && assets.include.files ? assets.include.files : DEFAULT_ASSETS_INCLUDE_FILES,
    },
  };
}

function parseSrcsGlob(srcs?: string[] | Partial<Glob>): Glob {
  if (!srcs) {
    return {
      exclude: {
        directories: DEFAULT_SRCS_EXCLUDE_DIRECTORIES,
      },
      include: {
        files: DEFAULT_SRCS_INCLUDE_FILES,
      },
    };
  }

  if (Array.isArray(srcs)) {
    return {
      exclude: {
        directories: DEFAULT_SRCS_EXCLUDE_DIRECTORIES,
      },
      include: {
        files: srcs,
      },
    };
  }

  return {
    exclude: {
      ...srcs.exclude,
      directories:
        srcs.exclude && srcs.exclude.directories ? srcs.exclude.directories : DEFAULT_SRCS_EXCLUDE_DIRECTORIES,
    },
    include: {
      ...srcs.include,
      files: srcs.include && srcs.include.files ? srcs.include.files : DEFAULT_SRCS_INCLUDE_FILES,
    },
  };
}

function parseBuild(options: BuildSchema, defaults: { [builderType: string]: any }): BuildOptionsConfig {
  if (typeof options === 'string') {
    return {
      type: options,
      config: defaults[options] || {},
    };
  }

  const { type, ...config } = options;
  return {
    type,
    config: {
      ...defaults[type],
      ...config,
    },
  };
}

function parseDeps(deps: ProjectSchema['deps']): ProjectConfig['dependencies'] {
  const build = new Set<string>();
  const lint = new Set<string>();

  Object.entries(deps || {}).forEach(([key, value]) => {
    if (value === 'build') {
      build.add(key);
      lint.add(key);
    } else if (value === 'lint') {
      lint.add(key);
    }
  });

  return { build: Array.from(build), lint: Array.from(lint) };
}

const loadProjectFromFile = memo(function loadProjectFromFile(
  workspace: WorkspaceConfig,
  configFile: string
): ProjectConfig {
  const originalConfig = fs.existsSync(configFile) ? parse(fs.readFileSync(configFile, 'utf-8')) : {};
  const config = Project.validate(workspace, originalConfig);

  if (!config.valid) {
    console.log(config.formattedErrors);
    console.log(config.errors);
    throw new Error(`Could not validate project config file at ${configFile}: ${config.errors}.`);
  }

  const rootDir = path.dirname(configFile);
  const name = path.relative(workspace.rootDir, rootDir);

  const res: ProjectConfig = {
    type: 'project',
    build: parseBuild(config.value.build, workspace.defaults.build),
    configFile,
    dependencies: parseDeps(config.value.deps),
    distDir: path.join(workspace.distDir, name),
    files: {
      assets: parseAssetsGlob(config.value.assets),
      sources: parseSrcsGlob(config.value.srcs),
    },
    name,
    originalConfig,
    rootDir,
    targets: new Map(),
    test: config.value.test || false,
    workspace,
  };

  workspace.pluginHooks.onProjectConfig.forEach((p) => p(res));

  for (const [targetName, targetData] of Object.entries(originalConfig.targets || {})) {
    res.targets.set(targetName, loadTarget(targetName, targetData as any, res));
  }

  return res;
});

export function loadProject(workspace: WorkspaceConfig, fileOrDirPath: string): ProjectConfig {
  const configFile = findProjectConfigPath(workspace, fileOrDirPath);
  return loadProjectFromFile(workspace, configFile);
}
