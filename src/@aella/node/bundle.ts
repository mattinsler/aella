import path from 'node:path';
import JSONC from 'jsonc-parser';
import { fs } from '@aella/core';
import lockfile from '@yarnpkg/lockfile';

import type { File } from '@aella/core';

import { buildPackageJson, pruneLockfile } from './package-utils.js';

/*
  wrapper functions do all the inputs/outputs and know about src/dist/bundle directories
  wrapper functions should collect the paths from the necessary places and pass to implementations
  there should be files and directories for input/output, probably rooted so that the paths all look the same
  implementation functions shouldn't know anything about anything... get rid of all the context stuff and put that in the wrappers
  outputs are just for tracking through to other inputs (and maybe caching), so they don't need to be exact if not necessary... so putting directory('node_modules') as an output should be fine, rather than all the dirs/files inside of it
  inputs can be directories, and need to be as exact as possible, because they will be used for the action graph, but also for calculating caches and maybe for building an action sandbox one day
*/

const shellScript = (entry: string) => `#!/bin/sh

BASEDIR=$(dirname $0)
node $BASEDIR/${entry}
`;

export interface NodeBundleConfig {
  links: Array<{ from: File; to: File }>;

  packageJson: File;
  yarnLock: File;
  outputRoot: string;

  entry?: string;
  name: string;
  nodeModules: string[];
}

export async function bundle(config: NodeBundleConfig) {
  await fs.rm(config.outputRoot, { force: true, recursive: true });

  const dirs = new Set(config.links.map(({ from }) => from.absoluteDirectory));
  await Promise.all(Array.from(dirs).map((dir) => fs.mkdir(dir, { recursive: true })));
  await Promise.all(config.links.map(({ from, to }) => fs.symlink(to.absolutePath, from.absolutePath)));

  const [packageJsonContent, yarnLockContent] = await Promise.all([
    fs.readFile(config.packageJson.absolutePath, 'utf-8'),
    fs.readFile(config.yarnLock.absolutePath, 'utf-8'),
  ]);

  const pkg = JSONC.parse(packageJsonContent);
  const yarn = lockfile.parse(yarnLockContent).object;

  const pkgJson = buildPackageJson({
    nodeModules: config.nodeModules,
    pkg,
  });
  const yarnLock = lockfile.stringify(pruneLockfile(yarn, pkgJson.dependencies));

  pkgJson.name = config.name;
  pkgJson.private = true;
  if (config.entry) {
    pkgJson.main = config.entry;
  }

  const writeFilePromises = [
    fs.writeFile(path.join(config.outputRoot, 'package.json'), JSON.stringify(pkgJson, null, 2), 'utf-8'),
    fs.writeFile(path.join(config.outputRoot, 'yarn.lock'), yarnLock, 'utf-8'),
  ];
  if (config.entry) {
    writeFilePromises.push(
      fs.writeFile(path.join(config.outputRoot, 'entry.sh'), shellScript(config.entry), {
        encoding: 'utf-8',
        mode: 0o755,
      })
    );
  }
  await Promise.all(writeFilePromises);
}
