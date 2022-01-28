import os from 'os';

import { loadContext } from '../context.js';

export async function list() {
  const context = await loadContext();
  const targets = (await context.getTargets()).map((target) =>
    target.isDefault ? target.project.name : `${target.project.name}:${target.name}`
  );

  targets.sort();

  console.log(targets.join(os.EOL));
}
