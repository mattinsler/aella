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
