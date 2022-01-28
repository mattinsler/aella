import path from 'path';

import type { RawTargetConfig } from './raw-types.js';
import type { ProjectConfig, TargetConfig } from '../types.js';

export function parseTargetConfig(
  config: RawTargetConfig,
  details: { name: string; project: ProjectConfig }
): TargetConfig {
  if (typeof config === 'string') {
    config = { entry: config };
  }

  const res: TargetConfig = {
    type: config.entry.endsWith('.ts') ? 'typescript' : config.entry.endsWith('.js') ? 'javascript' : 'shell',
    assets: config.assets || [],
    entry: config.entry,
    isDefault: path.basename(details.project.name) === details.name,
    name: details.name,
    options: {},
    project: details.project,
  };

  if (config.options) {
    if (typeof config.options !== 'object') {
      throw new Error(`Target options must be an object.`);
    }

    res.options = config.options;
  }

  return res;
}
