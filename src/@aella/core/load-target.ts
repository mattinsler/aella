import path from 'path';

import type { BundleOptionsConfig, Json, ProjectConfig, TargetConfig } from './types';

import { Target, TargetSchema } from './json-schema.js';

function parseBundle(options: TargetSchema, defaults: { [bundlerType: string]: any }): BundleOptionsConfig {
  const { bundle: type, target, ...config } = options;

  return {
    type,
    target,
    config: {
      ...defaults[type],
      ...config,
    },
  };
}

export function loadTarget(targetName: string, originalConfig: Json, project: ProjectConfig): TargetConfig {
  const config = Target.validate(project.workspace, originalConfig);

  if (!config.valid) {
    throw new Error(`Could not validate target config for ${targetName} in project ${project.name}: ${config.errors}.`);
  }

  let res: TargetConfig = {
    type: 'target',
    bundle: parseBundle(config.value, project.workspace.defaults.bundle),
    isDefault: path.basename(project.name) === targetName,
    name: targetName,
    originalConfig,
    project,
  };

  project.workspace.pluginHooks.onTargetConfig.forEach((p) => p(res));

  return res;
}
