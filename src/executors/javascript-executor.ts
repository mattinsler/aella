import path from 'path';

import type { Executor } from './types.js';

import { typescriptExecutor } from './typescript-executor.js';

export const javascriptExecutor: Executor = {
  type: 'javascript',

  handles(filename) {
    return Boolean(~['.js', '.jsx', '.cjs', '.mjs'].indexOf(path.extname(filename)));
  },

  async execute({ context, target, argv }) {
    await typescriptExecutor.execute({ context, target, argv });
  },
};
