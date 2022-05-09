import { build } from '@aella/core';

import type { DeployOptions } from '@aella/core';

export async function deploy(opts: DeployOptions): Promise<void> {
  await build(opts.project, { deps: true });

  // create package.json
  // create yarn.lock
  // create Dockerfile
}
