import path from 'path';

import { loadContext } from '../context.js';
import { getExecutorForFile } from '../executors/index.js';

export async function exec(argv: string[]) {
  const targetPath = path.resolve(argv[0]);
  const executor = getExecutorForFile(targetPath);

  if (!executor) {
    console.error(`Cannot execute ${argv[0]}`);
    process.exitCode = 1;
    return;
  }

  executor.execute({
    context: await loadContext(targetPath),
    target: {
      assets: [],
      entry: path.basename(targetPath),
      isDefault: true,
      name: '',
      options: {},
      project: {
        rootDir: path.dirname(targetPath),
      } as any,
      type: executor.type,
    },
    argv: argv.slice(1),
  });
}
