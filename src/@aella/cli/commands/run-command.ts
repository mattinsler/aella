import path from 'node:path';
import { execa } from 'execa';
import { createRequire } from 'node:module';
import { DefaultInfo, Providers, build } from '@aella/core';

import type { Command, ProjectConfig, TargetConfig, WorkspaceConfig } from '@aella/core';

const SOURCE_MAP_SUPPORT = createRequire(import.meta.url).resolve('source-map-support/register');

export function replaceExtension(file: string, desiredExtension: string) {
  if (!desiredExtension.startsWith('.')) {
    desiredExtension = `.${desiredExtension}`;
  }

  const ext = path.extname(file);
  return file.slice(0, -ext.length) + desiredExtension;
}

export function createCommand({
  file,
  project,
  target,
}: {
  file?: string;
  project: ProjectConfig;
  target?: TargetConfig;
}): Command {
  // const entry = file ? file : target ? target.entry : undefined;
  // if (!(target || file)) {
  if (!target) {
    throw new Error('No valid entrypoint to run.');
  }

  return {
    aliases: ['r'],
    args: ['PROJECT'],
    name: 'run',
    description: 'Run a project',
    execute: async (workspace: WorkspaceConfig, argv: string[]) => {
      // if (!target) {
      //   target = {
      //     assets: [],
      //     entry: file!,
      //     isDefault: false,
      //     name: file!,
      //     originalConfig: {},
      //     project,
      //   };
      // }

      const providers = await build(workspace, { target });
      const executables = DefaultInfo.executables(providers);

      if (executables.length === 0) {
        throw new Error('Cannot find an executable.');
      }

      console.log(executables.map((file) => file.pathRelativeTo(workspace.rootDir)).join('\n'));

      const { exitCode } = await execa(executables[0].absolutePath, argv, {
        cwd: process.cwd(),
        // nodeOptions: ['--require', SOURCE_MAP_SUPPORT],
        stdio: 'inherit',
      });

      return exitCode;
    },
  };
}
