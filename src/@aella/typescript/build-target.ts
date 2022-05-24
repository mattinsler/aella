import fs from 'node:fs';
import path from 'node:path';

import type { BuildTargetOptions, BuildTargetResult } from '@aella/core';

import { buildPackageJson, buildYarnLock, readPackageJson } from './package-utils.js';

function createSandbox(rootDir: string) {
  const dirs = new Set<string>();
  const files: Array<{ content: string; encoding: BufferEncoding; file: string }> = [];
  const symlinks: Array<{ file: string; target: string }> = [];

  return {
    async build() {
      await fs.promises.rm(rootDir, { force: true, recursive: true });
      await fs.promises.mkdir(rootDir, { recursive: true });

      await Promise.all(Array.from(dirs).map((dir) => fs.promises.mkdir(path.join(rootDir, dir), { recursive: true })));
      await Promise.all(symlinks.map(({ file, target }) => fs.promises.symlink(target, path.join(rootDir, file))));
      await Promise.all(
        files.map(({ content, encoding, file }) => fs.promises.writeFile(path.join(rootDir, file), content, encoding))
      );
    },

    get rootDir() {
      return rootDir;
    },

    symlink(file: string, target: string) {
      dirs.add(path.dirname(file));
      symlinks.push({ file, target: path.resolve(target) });
    },
    writeFile(file: string, content: string, encoding: BufferEncoding) {
      dirs.add(path.dirname(file));
      files.push({ content, encoding, file });
    },
  };
}

export async function buildTarget({ files, projects, target }: BuildTargetOptions): Promise<BuildTargetResult> {
  const sandbox = createSandbox(path.join(target.project.distDir, `${target.name}.sandbox`));

  files.outputs.forEach((file) => {
    sandbox.symlink(file, path.join(target.project.workspace.distDir, file));
  });

  const pkg = readPackageJson(target.project.workspace);
  const pkgJson = buildPackageJson({ extraDeps: target.project.test ? ['jest'] : [], pkg, projects });
  const yarnLock = buildYarnLock(target.project.workspace, pkgJson.dependencies);

  pkgJson.name = target.name;
  pkgJson.private = true;

  const entryIndex = files.inputs.indexOf(path.join(target.project.name, target.entry));
  if (entryIndex !== -1) {
    pkgJson.main = files.outputs[entryIndex];
  }

  sandbox.writeFile('package.json', JSON.stringify(pkgJson, null, 2), 'utf-8');
  sandbox.writeFile('yarn.lock', yarnLock, 'utf-8');

  Object.keys(pkgJson.dependencies).forEach((dep) =>
    sandbox.symlink(path.join('node_modules', dep), path.join(target.project.workspace.rootDir, 'node_modules', dep))
  );

  await sandbox.build();

  return {
    sandboxDir: sandbox.rootDir,
    target,
  };
}
