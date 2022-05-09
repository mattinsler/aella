import path from 'path';

import type { Json, ProjectConfig, TargetConfig } from './types';

import { Target } from './json-schema.js';

export function loadTarget(targetName: string, targetData: Json, project: ProjectConfig): TargetConfig {
  const config = Target.validate(targetData);

  if (!config.valid) {
    throw new Error(`Could not validate target config for ${targetName} in project ${project.name}: ${config.errors}.`);
  }

  let res: TargetConfig = {
    assets: [],
    entry: config.value,
    isDefault: path.basename(project.name) === targetName,
    name: targetName,
    originalConfig: targetData,
    project,
  };

  project.workspace.pluginHooks.onTargetConfig.forEach((p) => p(res, res.originalConfig));

  return res;
}
