import { DefaultInfo, Label, build, resolveTarget } from '@aella/core';

import type { WorkspaceConfig } from '@aella/core';

export async function execute(workspace: WorkspaceConfig, argv: string[]) {
  let providers;
  const { project, target } = resolveTarget(workspace, argv[0]);

  if (target) {
    console.log(`Building ${Label.toString(Label.from(target))}`);
    providers = await build(workspace, { target });
  } else if (project) {
    console.log(`Building ${Label.toString(Label.from(project))}`);
    providers = await build(workspace, { project });
  } else {
    throw new Error('Nothing to build.');
  }

  console.log(
    DefaultInfo.files(providers)
      .map((f) => f.pathRelativeTo(workspace.rootDir))
      .sort()
      .join('\n')
  );

  return 0;
}
