import path from 'path';

import type { Context } from './context.js';
import type { ProjectConfig, TargetConfig } from './types.js';

function parse(value: string) {
  const idx = value.indexOf(':');
  if (idx === -1) {
    return {
      projectName: value,
      targetName: path.basename(value),
    };
  }

  return {
    projectName: value.slice(0, idx),
    targetName: value.slice(idx + 1),
  };
}

export async function resolve(
  context: Context,
  argv: string[]
): Promise<{
  args: string[];
  project: ProjectConfig | null;
  target: TargetConfig | null;
}> {
  const { projectName, targetName } = parse(argv[0]);
  const project = await context.getProject(projectName);

  if (!project) {
    return { args: argv, project: null, target: null };
  }

  if (!project.targets.has(targetName)) {
    return { args: argv.slice(1), project, target: null };
  }

  return { args: argv.slice(1), project, target: project.targets.get(targetName) || null };
}
