import type {
  ProjectPluginFn,
  TargetPluginFn,
  WorkspacePluginFn,
  BuildOptions,
  Builder,
  Command,
  Dependency,
  DeployOptions,
  Deployer,
  Plugin,
  ProjectConfig,
  TargetConfig,
  WorkspaceConfig,
} from './types';
export type {
  ProjectPluginFn,
  TargetPluginFn,
  WorkspacePluginFn,
  BuildOptions,
  Builder,
  Command,
  DeployOptions,
  Deployer,
  Dependency,
  Plugin,
  ProjectConfig,
  TargetConfig,
  WorkspaceConfig,
};

import * as utils from './fs-utils.js';
export { utils };

export { glob } from './glob.js';
export { resolveTarget } from './resolve-target.js';
export { build, builderForProject } from './build.js';
export { deploy, deployerForProject } from './deploy.js';
export { filesFromProject } from './files-from-project.js';
export { transitiveProjects } from './transitive-projects.js';
export { generateJsonSchema } from './generate-json-schema.js';
export { findWorkspaceConfigPath, findWorkspaceRoot } from './find-workspace.js';
export {
  findAllProjectConfigFiles,
  findProjectConfigPath,
  findProjectNameFromFilePath,
  findProjectNameFromFilePathSync,
} from './find-project.js';

export { loadTarget } from './load-target.js';
export { loadProject } from './load-project.js';
export { createEmptyWorkspaceConfig, loadWorkspace } from './load-workspace.js';
