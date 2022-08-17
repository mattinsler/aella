export * from './types.js';

import * as utils from './fs-utils.js';
export { utils };

export { fs } from './fs.js';
export { glob } from './glob.js';
export { build } from './build.js';
export { Label } from './label.js';
export { DefaultInfo } from './default-info.js';
export { createKernel } from './kernel/index.js';
export { resolveTarget } from './resolve-target.js';
export { filesFromProject } from './files-from-project.js';
export { transitiveProjects } from './transitive-projects.js';
export { generateJsonSchema } from './generate-json-schema.js';
export { Provider, Providers } from './providers.js';
export { findWorkspaceConfigPath, findWorkspaceRoot } from './find-workspace.js';
export {
  findAllProjectConfigFiles,
  findAllTestDirectories,
  findProjectConfigPath,
  findProjectNameFromFilePath,
  findProjectNameFromFilePathSync,
} from './find-project.js';

export { loadTarget } from './load-target.js';
export { loadProject } from './load-project.js';
export { createWorkspaceConfig, loadWorkspace } from './load-workspace.js';

import type { BuildOptions, Builder, BuildStepContext, BundleOptions, Bundler, Plugin, Provider } from './types.js';

export function plugin(fn: Plugin): Plugin {
  return fn;
}

export function builder<TConfig = {}>(
  fn: (context: BuildStepContext, opts: Omit<BuildOptions, 'config'> & { config: TConfig }) => Provider[]
): Builder['build'] {
  return fn;
}

export function bundler<TConfig = {}>(
  fn: (context: BuildStepContext, opts: Omit<BundleOptions, 'config'> & { config: TConfig }) => Provider[]
): Bundler['bundle'] {
  return fn;
}
