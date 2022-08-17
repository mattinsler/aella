import esbuild from 'esbuild';

import type { File } from '@aella/core';

import { plugin } from './build-plugin.js';

export interface TypeScriptBuildConfig {
  files: File[];
  outdir: string;
  outbase: string;
  target: string;
  tsconfig: File;
}

export async function build(config: TypeScriptBuildConfig) {
  // should handle errors and warnings
  await esbuild.build({
    entryPoints: config.files.map((file) => file.absolutePath),
    format: 'esm',
    outdir: config.outdir,
    outbase: config.outbase,
    platform: 'node',
    plugins: [plugin(config.tsconfig.absoluteDirectory)],
    sourcemap: 'inline',
    target: config.target,
    tsconfig: config.tsconfig.absolutePath,
  });
}
