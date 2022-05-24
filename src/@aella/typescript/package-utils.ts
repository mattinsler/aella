import fs from 'node:fs';
import path from 'node:path';
import JSONC from 'jsonc-parser';
import lockfile from '@yarnpkg/lockfile';

import type { LockFileObject } from '@yarnpkg/lockfile';
import type { ProjectConfig, WorkspaceConfig } from '@aella/core';

function createPackageJsonDependencies(
  projects: ProjectConfig[],
  pkg: { [key: string]: any },
  extraDeps: string[]
): Record<string, string> {
  const modules = new Set(projects.flatMap((project) => project.dependencies.build));
  const { dependencies, devDependencies, optionalDependencies, peerDependencies } = pkg;

  const deps = [
    ...extraDeps,
    ...[
      ...Object.keys(dependencies || {}),
      ...Object.keys(devDependencies || {}),
      ...Object.keys(optionalDependencies || {}),
      ...Object.keys(peerDependencies || {}),
    ].filter((dep) => modules.has(dep)),
  ];

  return deps.reduce<Record<string, string>>((o, dep) => {
    o[dep] = dependencies[dep] || devDependencies[dep];
    return o;
  }, {});
}

export function buildPackageJson({
  extraDeps = [],
  pkg,
  projects,
}: {
  extraDeps?: string[];
  pkg: { [key: string]: any };
  projects: ProjectConfig[];
}) {
  const dependencies = createPackageJsonDependencies(projects, pkg, extraDeps);

  const pkgJson: { [key: string]: any } = {
    version: pkg.version || '1.0.0',
    engines: {
      node: pkg.engines && pkg.engines.node ? pkg.engines.node : `>=${process.versions.node}`,
    },
    dependencies,
  };

  if (pkg.type) {
    pkgJson.type = pkg.type;
  }

  return pkgJson;
}

export function readPackageJson(workspace: WorkspaceConfig): { [key: string]: any } {
  const pkgJsonFile = path.join(workspace.rootDir, 'package.json');
  return JSONC.parse(fs.readFileSync(pkgJsonFile, 'utf-8'));
}

function dependenciesToLockfilePackages(dependencies: Record<string, string>): string[] {
  return Object.entries(dependencies).map(([pkg, version]) => `${pkg}@${version}`);
}

export function pruneLockfile(lockfile: LockFileObject, dependencies: Record<string, string>): LockFileObject {
  const res: LockFileObject = {};

  const queue = dependenciesToLockfilePackages(dependencies);

  while (queue.length) {
    const pkg = queue.shift()!;
    if (!res[pkg]) {
      res[pkg] = lockfile[pkg];
      queue.push(...dependenciesToLockfilePackages(lockfile[pkg].dependencies || {}));
    }
  }

  return res;
}

export function buildYarnLock(workspace: WorkspaceConfig, dependencies: Record<string, string>) {
  const yarnLockFile = path.join(workspace.rootDir, 'yarn.lock');
  const yarnLock = lockfile.parse(fs.readFileSync(yarnLockFile, 'utf-8'));
  return lockfile.stringify(pruneLockfile(yarnLock.object, dependencies));
}
