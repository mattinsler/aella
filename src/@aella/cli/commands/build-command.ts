import { build as buildProject, resolveTarget } from '@aella/core';

import type { Command, WorkspaceConfig } from '@aella/core';

async function execute(workspace: WorkspaceConfig, argv: string[]) {
  const { project } = resolveTarget(workspace, argv[0]);

  if (!project) {
    throw new Error('Nothing to build.');
  }

  console.log(await buildProject(project, { deps: true }));

  return 0;
}

export const build: Command = {
  aliases: [],
  args: ['PROJECT'],
  execute,
  name: 'build',
  description: 'Build a project',
};
