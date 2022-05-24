import fs from 'node:fs';
import path from 'node:path';
import esbuild from 'esbuild';
import resolve from 'resolve';
import isBuiltinModule from 'is-builtin-module';
import { MatchPath, createMatchPath, loadConfig } from 'tsconfig-paths';

import { Dependency, WorkspaceConfig, findProjectNameFromFilePathSync } from '@aella/core';

import { LOADERS } from './loaders.js';
import { parseImports } from './parse-imports.js';

const SUPPORTED_EXTENSIONS = Object.keys(LOADERS);
const EXTRACT_MODULE_NAME_RX = /(@[^\/]+\/)?[^\/]+/;
const FILE_PREFIX_RX = new RegExp(
  `\.(${Object.keys(LOADERS)
    .map((ext) => ext.slice(1))
    .join('|')})$`
);

function resolveAll(deps: string[]): Promise<string[]> {
  return Promise.all(
    deps.map((dep) => {
      if (!dep.startsWith('/')) {
        return dep;
      }

      return new Promise<string>((res, rej) =>
        resolve(dep.replace(/\.js$/, ''), { extensions: SUPPORTED_EXTENSIONS }, (err, value) => {
          if (err) {
            return rej(err);
          }
          res(value!);
        })
      );
    })
  );
}

interface DependencyResolver {
  (dep: string, sourceFilename: string): string;
}

function createDependencyResolver(workspace: WorkspaceConfig): DependencyResolver {
  const matchersByDir: { [dir: string]: MatchPath } = {};

  return (dep: string, sourceFilename: string) => {
    const dir = path.dirname(sourceFilename);
    if (!matchersByDir[dir]) {
      let loadConfigRes = loadConfig(dir);
      if (loadConfigRes.resultType === 'failed') {
        const projectName = findProjectNameFromFilePathSync(workspace, sourceFilename);
        if (projectName != null) {
          fs.writeFileSync(
            path.join(workspace.rootDir, projectName!, 'tsconfig.json'),
            JSON.stringify(
              {
                extends: path.relative(projectName, 'tsconfig.base.json'),
              },
              null,
              2
            ),
            'utf-8'
          );
        } else {
          throw new Error(`Cannot find a project from ${dir}`);
        }
        loadConfigRes = loadConfig(dir);
      }
      if (loadConfigRes.resultType === 'failed') {
        throw new Error(`Cannot load tsconfig from ${dir}: ${loadConfigRes.message}`);
      }

      matchersByDir[dir] = createMatchPath(
        loadConfigRes.absoluteBaseUrl,
        loadConfigRes.paths,
        loadConfigRes.mainFields,
        loadConfigRes.addMatchAll
      );
    }

    const matchPath = matchersByDir[dir];

    if (isBuiltinModule(dep)) {
      return dep;
    }
    if (dep.startsWith('.')) {
      return path.resolve(path.dirname(sourceFilename), dep);
    }
    if (dep.startsWith('//')) {
      return path.resolve(workspace.rootDir, dep.slice(2));
    }

    const ext = path.extname(dep);
    const depPath = ext ? dep.slice(0, -ext.length) : dep;
    const match = matchPath(depPath, undefined, undefined, SUPPORTED_EXTENSIONS);
    if (match) {
      return path.resolve(path.dirname(sourceFilename), match);
    }

    return dep.match(EXTRACT_MODULE_NAME_RX)![0];
  };
}

async function readFiles(files: string[], dependencyResolver: DependencyResolver) {
  const cache: Record<string, { content: string; imports: string[] }> = {};

  await Promise.all(
    files.map(async (file) => {
      const content = await fs.promises.readFile(file, 'utf-8');

      const imports = new Set<string>();

      parseImports(content, file).forEach((dep) => {
        const resolved = dependencyResolver(dep, file);
        if (!isBuiltinModule(resolved)) {
          imports.add(resolved);
        }
      });

      cache[file] = {
        content,
        imports: await resolveAll(Array.from(imports)),
      };
    })
  );

  return {
    deps: new Set<string>(Object.values(cache).flatMap(({ imports }) => imports)),
    files: cache,
  };
}

export function plugin(workspace: WorkspaceConfig): {
  readonly deps: Dependency[];
  readonly plugin: esbuild.Plugin;
} {
  const cache: {
    deps: Set<string>;
    files: Record<
      string,
      {
        content: string;
        imports: string[];
      }
    >;
  } = {
    deps: new Set(),
    files: {},
  };
  const resolvedDeps = new Set<string>();
  const dependencyResolver = createDependencyResolver(workspace);

  return {
    get deps() {
      const deps = Array.from(new Set([...cache.deps, ...resolvedDeps]));

      return deps.map<Dependency>((dep) => {
        const build = resolvedDeps.has(dep);

        return {
          build,
          // types-only and build deps are both part of lint
          lint: true,
          value: dep,
        };
      });
    },

    plugin: {
      name: '@aella/typescript/extract-dependencies',
      async setup(build) {
        const filesData = await readFiles((build.initialOptions.entryPoints as string[]) || [], dependencyResolver);
        filesData.deps.forEach((d) => cache.deps.add(d));
        Object.entries(filesData.files).forEach(([k, v]) => (cache.files[k] = v));

        build.onLoad({ filter: FILE_PREFIX_RX }, (args) => {
          const file = cache.files[args.path];

          return file
            ? {
                contents: file.content,
                loader: LOADERS[path.extname(args.path)],
              }
            : null;
        });

        build.onResolve({ filter: /./ }, (args) => {
          if (cache.files[args.importer]) {
            const resolved = dependencyResolver(args.path, args.importer);
            if (!isBuiltinModule(resolved)) {
              resolvedDeps.add(resolved);
            }
          }

          return {
            external: !!args.importer,
          };
        });

        build.onEnd(async () => {
          const fullyResolvedDeps = await resolveAll(Array.from(resolvedDeps));
          resolvedDeps.clear();
          fullyResolvedDeps.forEach((dep) => resolvedDeps.add(dep));
        });
      },
    },
  };
}
