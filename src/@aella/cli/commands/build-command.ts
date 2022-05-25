import { build, resolveTarget } from '@aella/core';

import type { WorkspaceConfig } from '@aella/core';

export async function execute(workspace: WorkspaceConfig, argv: string[]) {
  const { project, target } = resolveTarget(workspace, argv[0]);

  if (!project) {
    throw new Error('Nothing to build.');
  }

  if (target) {
    console.log(await build({ target }));
  } else {
    console.log(await build({ project, deps: true }));
  }

  return 0;
}
