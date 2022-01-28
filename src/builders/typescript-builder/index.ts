import fs from 'fs';
import task from 'tasuku';
import getValue from 'get-value';

import type { ProjectConfig, TargetConfig, WorkspaceConfig } from '../../types.js';

import { ensureTsconfig } from './ensure-tsconfig.js';

export interface BuildOptions {
  project: ProjectConfig;
  target?: TargetConfig | null;
  workspace: WorkspaceConfig;
}

async function clean(workspace: WorkspaceConfig) {
  await fs.promises.rm(workspace.distDir, { force: true, recursive: true });
  await fs.promises.mkdir(workspace.distDir, { recursive: true });
}

async function resolveBuilder(project: ProjectConfig) {
  const builder = getValue(project.options, 'build.builder', 'esbuild');

  switch (builder) {
    case 'esbuild':
      return (await import('./build-esbuild.js')).build;
    case 'tsc':
      return (await import('./build-tsc.js')).build;
  }

  throw new Error(`Unknown builder type: ${builder}.`);
}

export const typescriptBuilder = {
  async build({ project, workspace }: BuildOptions) {
    await task(`Building ${project.name}`, async (taskHelpers) => {
      const { task } = taskHelpers;
      await task.group((task) => [
        task('Clean workspace', () => clean(workspace)),
        task('Ensure tsconfig.json exists', () => ensureTsconfig({ project, workspace })),
      ]);

      // pick builder
      const build = await resolveBuilder(project);
      await build({ project, workspace, taskHelpers });
    });
  },
};
