import path from 'node:path';
import esbuild from 'esbuild';

import type { BuildProjectOptions, BuildProjectResult } from '@aella/core';

import { LOADERS } from './loaders.js';
import { plugin } from './build-plugin.js';
import { replaceExtension } from './utils.js';

const SUPPORTED_EXTENSIONS = new Set(Object.keys(LOADERS));

export async function buildProject({ files, project }: BuildProjectOptions): Promise<BuildProjectResult> {
  const tsconfig = path.join(project.rootDir, 'tsconfig.json');

  const inputs = files.sources.filter(
    (file) => SUPPORTED_EXTENSIONS.has(path.extname(file)) && !file.endsWith('.d.ts')
  );
  const outputs = inputs.map((file) => replaceExtension(file, '.js'));

  // should handle errors and warnings
  await esbuild.build({
    entryPoints: inputs.map((file) => path.join(project.rootDir, file)),
    format: 'esm',
    outdir: project.workspace.distDir,
    outbase: project.workspace.rootDir,
    platform: 'node',
    plugins: [plugin(project.rootDir)],
    sourcemap: 'inline',
    target: `node${process.version.slice(1)}`,
    tsconfig,
  });

  return {
    inputs,
    outputs,
    project,
  };
}
