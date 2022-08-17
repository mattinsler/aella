import fs from 'fs';
import path from 'path';
import { fdir } from 'fdir';
import { fileURLToPath } from 'url';
import { parse } from 'es-module-lexer';
import isBuiltinModule from 'is-builtin-module';

import { findProjects } from './find-projects.js';

const EXTRACT_MODULE_NAME_RX = /(@[^\/]+\/)?[^\/]+/;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
const DEPS = {
  ...PKG.dependencies,
  ...PKG.devDependencies,
  ...PKG.optionalDependencies,
  ...PKG.peerDependencies,
};

async function projectDeps(dir) {
  const files = new fdir()
    .withRelativePaths()
    .exclude((d) => d === 'node_modules')
    .glob('**/*.js')
    .crawl(dir)
    .sync();
  const deps = new Set();
  await Promise.all(
    files.flatMap(async (file) => {
      const [imports] = await parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
      imports
        .map((i) => i.n)
        .filter(Boolean)
        .filter((i) => !isBuiltinModule(i))
        .filter((i) => !i.startsWith('.'))
        .map((i) => i.match(EXTRACT_MODULE_NAME_RX)[0])
        .forEach((i) => deps.add(i));
    })
  );
  return Array.from(deps);
}

function projectPackageJson(project, projectsByName) {
  const pkg = {
    name: project.name,
    description: project.config.description || '',
    version: PKG.version,
    license: 'MIT',
    type: 'module',
    exports: './index.js',
    types: './index.d.ts',
    engines: {
      node: '>=14.13.1 || >=16.0.0',
    },
    dependencies: project.deps.sort().reduce((agg, dep) => {
      if (projectsByName[dep]) {
        agg[dep] = PKG.version;
      } else if (DEPS[dep]) {
        agg[dep] = DEPS[dep];
      } else {
        console.warn(`Cannot find dep ${dep} of project ${project.name}`);
      }
      return agg;
    }, {}),
  };

  if (project.config.bin) {
    pkg.bin = project.config.bin;
  }

  return pkg;
}

const { projects, projectsByName } = findProjects(ROOT);

await Promise.all(
  projects.map(async (p) => {
    p.deps = await projectDeps(p.distDir);
  })
);

projects.forEach((project) => {
  fs.writeFileSync(
    path.join(project.distDir, 'package.json'),
    JSON.stringify(projectPackageJson(project, projectsByName), null, 2),
    'utf-8'
  );
});
