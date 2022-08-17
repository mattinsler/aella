import type { LockFileObject } from '@yarnpkg/lockfile';

function createPackageJsonDependencies({
  nodeModules,
  pkg,
}: {
  nodeModules: string[];
  pkg: Record<string, any>;
}): Record<string, string> {
  const nodeModulesSet = new Set(nodeModules);
  const { dependencies, devDependencies, optionalDependencies, peerDependencies } = pkg;

  const deps = [
    ...[
      ...Object.keys(dependencies || {}),
      ...Object.keys(devDependencies || {}),
      ...Object.keys(optionalDependencies || {}),
      ...Object.keys(peerDependencies || {}),
    ].filter((dep) => nodeModulesSet.has(dep)),
  ];

  return deps.reduce<Record<string, string>>((o, dep) => {
    o[dep] = dependencies[dep] || devDependencies[dep];
    return o;
  }, {});
}

export function buildPackageJson({ nodeModules, pkg }: { nodeModules: string[]; pkg: Record<string, any> }) {
  const dependencies = createPackageJsonDependencies({ nodeModules, pkg });

  const pkgJson: Record<string, any> = {
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

// export function readPackageJson(workspace: WorkspaceConfig): Record<string, any> {
//   const pkgJsonFile = path.join(workspace.rootDir, 'package.json');
//   return JSONC.parse(fs.readFileSync(pkgJsonFile, 'utf-8'));
// }

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

// export function buildYarnLock(workspace: WorkspaceConfig, dependencies: Record<string, string>) {
//   const yarnLockFile = path.join(workspace.rootDir, 'yarn.lock');
//   const yarnLock = lockfile.parse(fs.readFileSync(yarnLockFile, 'utf-8'));
//   return lockfile.stringify(pruneLockfile(yarnLock.object, dependencies));
// }
