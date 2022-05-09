import { deploy as deployProject, resolveTarget } from '@aella/core';

import type { Command, WorkspaceConfig } from '@aella/core';

async function execute(workspace: WorkspaceConfig, argv: string[]) {
  const { project, target } = resolveTarget(workspace, argv[0]);

  if (!project) {
    throw new Error('Nothing to deploy.');
  }

  await deployProject({ project, target });

  return 0;
}

export const deploy: Command = {
  aliases: [],
  args: ['PROJECT[:TARGET]'],
  execute,
  name: 'deploy',
  description: 'Deploy a project or target',
};
