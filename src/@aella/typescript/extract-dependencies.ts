import fs from 'node:fs';
import path from 'node:path';
import esbuild from 'esbuild';
import { parse } from 'jsonc-parser';

import type { BuildOptions, Dependency } from '@aella/core';

import { isFileSupported } from './supported.js';
import { plugin } from './extract-dependencies-plugin.js';

export async function extractDependencies({ sources, project }: BuildOptions): Promise<Dependency[]> {
  // const tsconfig = path.join(project.rootDir, 'tsconfig.json');
  const pkg = parse(await fs.promises.readFile(path.join(project.workspace.rootDir, 'package.json'), 'utf-8'));
  const inputs = sources.filter(isFileSupported);

  const external = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
    ...Object.keys(pkg.optionalDependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
  ];

  const extract = plugin(project.workspace);

  // TODO: handle errors and warnings
  await esbuild.build({
    bundle: true,
    entryPoints: inputs.map((file) => file.absolutePath),
    external,
    format: 'esm',
    outdir: project.workspace.distDir,
    outbase: project.workspace.rootDir,
    platform: 'node',
    plugins: [extract.plugin],
    target: `node${process.version.slice(1)}`,
    // tsconfig,
    write: false,
  });

  return extract.deps;
}
