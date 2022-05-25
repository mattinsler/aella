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
  if (!(target || file)) {
    throw new Error('No valid entrypoint to run.');
  }

  return {
    aliases: ['r'],
    args: ['PROJECT'],
    name: 'run',
    description: 'Run a project',
    execute: async (workspace: WorkspaceConfig, argv: string[]) => {
      if (!target) {
        target = {
          assets: [],
          entry: file!,
          isDefault: false,
          name: file!,
          originalConfig: {},
          project,
        };
      }
      const { sandboxDir } = await build({ target });

      // const idx = inputs.indexOf(path.join(project.name, entry));
      // if (idx === -1) {
      //   throw new Error(`Cannot find the entrypoint ${entry}.`);
      // }

      // const targetPath = path.join(workspace.distDir, outputs[idx]);

      const { exitCode } = await execaNode(sandboxDir, argv, {
        cwd: process.cwd(),
        nodeOptions: ['--require', SOURCE_MAP_SUPPORT],
        stdio: 'inherit',
      });

      return exitCode;
    },
  };
}
