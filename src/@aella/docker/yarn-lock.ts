import fs from 'node:fs';
import path from 'node:path';
import lockfile from '@yarnpkg/lockfile';

import type { WorkspaceConfig } from '@aella/core';
import type { LockFileObject } from '@yarnpkg/lockfile';

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
  const yarnLock = lockfile.parse(fs.readFileSync(path.join(workspace.rootDir, 'yarn.lock'), 'utf-8'));
  return lockfile.stringify(pruneLockfile(yarnLock.object, dependencies));
}
