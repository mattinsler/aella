import path from 'path';
import { execaCommand } from 'execa';

import type { Executor } from './types.js';

export const shellExecutor: Executor = {
  type: 'shell',

  handles(filename) {
    return path.extname(filename) === '.sh';
  },

  async execute({ context, target, argv }) {
    const PATH = [path.join(context.workspace.rootDir, 'node_modules', '.bin'), process.env.PATH || ''].join(
      path.delimiter
    );

    const { exitCode } = await execaCommand([target.entry, ...argv].join(' '), {
      cwd: target.project.rootDir,
      env: {
        ...process.env,
        PATH,
      },
      stdio: 'inherit',
    });

    process.exitCode = exitCode;
  },
};
