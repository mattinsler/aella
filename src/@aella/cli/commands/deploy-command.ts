import { deploy, resolveTarget } from '@aella/core';

import type { WorkspaceConfig } from '@aella/core';

export async function execute(workspace: WorkspaceConfig, argv: string[]) {
  const { project, target } = resolveTarget(workspace, argv[0]);

  if (!project) {
    throw new Error('Nothing to deploy.');
  }

  await deploy({ project, target });

  return 0;
}
