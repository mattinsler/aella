import path from 'node:path';
import { execaNode } from 'execa';
import { build } from '@aella/core';
import { createRequire } from 'node:module';

import type { Command, ProjectConfig, TargetConfig, WorkspaceConfig } from '@aella/core';

const SOURCE_MAP_SUPPORT = createRequire(import.meta.url).resolve('source-map-support/register');

export function replaceExtension(file: string, desiredExtension: string) {
  if (!desiredExtension.startsWith('.')) {
    desiredExtension = `.${desiredExtension}`;
  }

  const ext = path.extname(file);
  return file.slice(0, -ext.length) + desiredExtension;
}

export const run: Command & {
  createCommand(opts: { file: string | null; project: ProjectConfig; target: TargetConfig | null }): Command;
} = {
  aliases: [],
  args: ['PROJECT[:TARGET]'],
  name: '',
  description: 'Run a project target',
  execute: () => Promise.reject(),

  createCommand({ file, project, target }) {
    let entryFile: string;

    if (file) {
      entryFile = replaceExtension(file, '.js');
    } else if (target) {
      entryFile = replaceExtension(target.entry, '.js');
    } else {
      throw new Error('No valid entrypoint to run.');
    }

    entryFile = path.relative(project.workspace.rootDir, path.join(project.workspace.distDir, project.name, entryFile));

    return {
      aliases: ['r'],
      args: ['PROJECT'],
      name: 'run',
      description: 'Run a project',
      execute: async (workspace: WorkspaceConfig, argv: string[]) => {
        const { outputs } = await build(project, { deps: true });

        if (!outputs.includes(entryFile)) {
          throw new Error(`Cannot find the entrypoint ${entryFile}.`);
        }

        const targetPath = path.join(workspace.rootDir, entryFile);

        const { exitCode } = await execaNode(targetPath, argv, {
          cwd: process.cwd(),
          nodeOptions: ['--require', SOURCE_MAP_SUPPORT],
          stdio: 'inherit',
        });

        return exitCode;
      },
    };
  },
};
