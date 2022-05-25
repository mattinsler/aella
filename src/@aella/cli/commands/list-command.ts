import os from 'node:os';
import { findAllProjectConfigFiles, loadProject } from '@aella/core';

import type { WorkspaceConfig } from '@aella/core';

export async function execute(workspace: WorkspaceConfig, argv: string[]) {
  const configFiles = await findAllProjectConfigFiles(workspace);
  const projects = configFiles.map((file) => loadProject(workspace, file));

  if (argv[0] === 'targets') {
    const targets = projects.flatMap((project) =>
      [...project.targets.values()].map((target) =>
        target.isDefault ? target.project.name : `${target.project.name}:${target.name}`
      )
    );

    targets.sort();

    console.log(targets.join(os.EOL));
  } else {
    const projectNames = projects.map((project) => project.name);
    projectNames.sort();
    console.log(projectNames.join(os.EOL));
  }

  return 0;
}
