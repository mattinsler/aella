import path from 'path';

import type { TargetConfig } from '../types.js';

import { getExecutor } from '../executors/index.js';
import { Context, loadContext } from '../context.js';

function parseTarget(value: string): { projectName: string; targetName: string } {
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

async function getTarget(
  context: Context,
  argv: string[]
): Promise<{
  args: string[];
  fullName: string;
  target: TargetConfig;
} | null> {
  const { projectName, targetName } = parseTarget(argv[0]);
  const project = await context.getProject(projectName);

  if (project) {
    if (project.targets.has(targetName)) {
      return { args: argv.slice(1), fullName: argv[0], target: project.targets.get(targetName)! };
    }
    if (targetName === projectName && project.targets.has(argv[1])) {
      return { args: argv.slice(2), fullName: `${argv[0]} ${argv[1]}`, target: project.targets.get(argv[1])! };
    }
  }

  return null;
}

export async function run(argv: string[]) {
  const context = await loadContext();
  const targetRes = await getTarget(context, argv);

  if (!targetRes) {
    console.error(`Could not find command ${argv[0]}`);
    process.exitCode = 1;
    return;
  }

  const { args, fullName, target } = targetRes;
  const executor = getExecutor(target.type);

  if (!executor) {
    console.error(`Cannot execute command ${fullName} of type ${target.type}`);
    process.exitCode = 1;
    return;
  }

  await executor.execute({ context, target, argv: args });
}
