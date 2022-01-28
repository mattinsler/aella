import path from 'path';
import { execaNode } from 'execa';
import { createRequire } from 'module';

import type { Executor } from './types.js';

import { typescriptBuilder } from '../builders/typescript-builder/index.js';

const SOURCE_MAP_SUPPORT = createRequire(import.meta.url).resolve('source-map-support/register');

export const typescriptExecutor: Executor = {
  type: 'typescript',

  handles(filename) {
    return Boolean(~['.ts', '.tsx', '.cts', '.mts'].indexOf(path.extname(filename)));
  },

  async execute({ context, target, argv }) {
    await typescriptBuilder.build({ project: target.project, workspace: context.workspace });

    const targetPath = path.join(
      context.workspace.distDir,
      path.relative(context.workspace.rootDir, target.project.rootDir),
      `${target.entry.slice(0, -path.extname(target.entry).length)}.js`
    );

    const { exitCode } = await execaNode(targetPath, argv, {
      cwd: process.cwd(),
      nodeOptions: ['--require', SOURCE_MAP_SUPPORT],
      stdio: 'inherit',
    });

    process.exitCode = exitCode;
  },
};
