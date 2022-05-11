import fs from 'node:fs';
import path from 'node:path';
import JSONC from 'jsonc-parser';
import { transitiveProjects } from '@aella/core';

import type { ProjectConfig } from '@aella/core';

function createPackageJsonDependencies(projects: ProjectConfig[], pkg: any): Record<string, string> {
  const modules = new Set(projects.flatMap((project) => project.dependencies.build));
  const { dependencies, devDependencies, optionalDependencies, peerDependencies } = pkg;

  const deps = [
    ...Object.keys(dependencies || {}),
    ...Object.keys(devDependencies || {}),
    ...Object.keys(optionalDependencies || {}),
    ...Object.keys(peerDependencies || {}),
  ]
    .filter((dep) => modules.has(dep))
    .reduce<Record<string, string>>((o, dep) => {
      o[dep] = dependencies[dep] || devDependencies[dep];
      return o;
    }, {});

  return deps;
}

export function buildPackageJson(project: ProjectConfig) {
  const pkg = JSONC.parse(fs.readFileSync(path.join(project.workspace.rootDir, 'package.json'), 'utf-8'));
  const projects = transitiveProjects(project, 'build');
  const dependencies = createPackageJsonDependencies(projects, pkg);

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
