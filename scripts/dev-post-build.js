import fs from 'fs';
import path from 'path';
import { fdir } from 'fdir';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { parse } from 'es-module-lexer';
import isBuiltinModule from 'is-builtin-module';

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
  return {
    name: project.name,
    description: '',
    version: '0.0.0',
    license: 'MIT',
    type: 'module',
    exports: './index.js',
    types: './index.d.ts',
    engines: {
      node: '>=14.13.1 || >=16.0.0',
    },
    dependencies: project.deps.reduce((agg, dep) => {
      if (projectsByName[dep]) {
        // agg[dep] = path.relative(project.distDir, projectsByName[dep].distDir);
      } else if (DEPS[dep]) {
        agg[dep] = DEPS[dep];
      } else {
        console.warn(`Cannot find dep ${dep} of project ${project.name}`);
      }
      return agg;
    }, {}),
  };
}

const projects = new fdir()
  .withRelativePaths()
  .exclude((d) => d === 'node_modules' || d === 'dist' || d === '.git')
  .glob('**/project.json')
  .crawl(path.join(ROOT, 'src'))
  .sync()
  .map((f) => {
    const name = path.dirname(f);
    return {
      distDir: path.join(ROOT, 'dist', name),
      name,
      srcDir: path.join(ROOT, 'src', name),
    };
  });

const projectsByName = projects.reduce((agg, p) => {
  agg[p.name] = p;
  return agg;
}, {});

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

await Promise.all(
  projects.map(
    (project) =>
      new Promise((resolve, reject) => {
        exec('yarn install', { cwd: project.distDir }, (err) => {
          if (err) {
            err.message = `[${project.name}]\n` + err.message;
            return reject(err);
          }
          resolve();
        });
      })
  )
);

projects.forEach((project) => {
  project.deps.forEach((dep) => {
    if (projectsByName[dep]) {
      fs.mkdirSync(path.dirname(path.join(project.distDir, 'node_modules', dep)), { recursive: true });
      fs.symlinkSync(projectsByName[dep].distDir, path.join(project.distDir, 'node_modules', dep));
    }
  });
});
