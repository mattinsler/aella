import fs from 'node:fs';
import memo from 'memoizee';
import path from 'node:path';
import { parse } from 'jsonc-parser';

import type { Glob, ProjectConfig, WorkspaceConfig } from './types';

import { Project } from './json-schema.js';
import { loadTarget } from './load-target.js';
import { findProjectConfigPath } from './find-project.js';

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

const loadProjectFromFile = memo(function loadProjectFromFile(
  workspace: WorkspaceConfig,
  configFile: string
): ProjectConfig {
  const originalConfig = fs.existsSync(configFile) ? parse(fs.readFileSync(configFile, 'utf-8')) : {};
  const config = Project.validate(originalConfig);

  if (!config.valid) {
    throw new Error(`Could not validate project config file at ${configFile}: ${config.errors}.`);
  }

  const rootDir = path.dirname(configFile);
  const name = path.relative(workspace.rootDir, rootDir);

  const res: ProjectConfig = {
    configFile,
    dependencies: {
      build: config.value.dependencies?.build || [],
      lint: config.value.dependencies?.lint || [],
    },
    distDir: path.join(workspace.distDir, name),
    files: {
      assets: parseAssetsGlob(config.value.assets),
      sources: parseSrcsGlob(config.value.srcs),
    },
    name,
    originalConfig,
    rootDir,
    targets: new Map(),
    workspace,
  };

  workspace.pluginHooks.onProjectConfig.forEach((p) => p(res, res.originalConfig));

  for (const [targetName, targetData] of Object.entries(originalConfig.targets || {})) {
    res.targets.set(targetName, loadTarget(targetName, targetData as any, res));
  }

  return res;
});

export function loadProject(workspace: WorkspaceConfig, fileOrDirPath: string): ProjectConfig {
  const configFile = findProjectConfigPath(workspace, fileOrDirPath);
  return loadProjectFromFile(workspace, configFile);
}
