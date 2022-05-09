import fs from 'node:fs';
import path from 'node:path';
import esbuild from 'esbuild';
import resolve from 'resolve';
import isBuiltinModule from 'is-builtin-module';

import type { Dependency } from '@aella/core';

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

async function readFiles(rootDir: string, files: string[]) {
  const cache: Record<string, { content: string; imports: string[] }> = {};

  await Promise.all(
    files.map(async (file) => {
      const content = await fs.promises.readFile(file, 'utf-8');

      const imports = new Set<string>();

      parseImports(content, file).forEach((i) => {
        if (i.startsWith('.')) {
          imports.add(path.resolve(path.dirname(file), i));
        } else if (i.startsWith('//')) {
          imports.add(path.resolve(rootDir, i.slice(2)));
        } else if (!isBuiltinModule(i)) {
          imports.add(i.match(EXTRACT_MODULE_NAME_RX)![0]);
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

export function plugin({ workspaceRootDir }: { workspaceRootDir: string }): {
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
      name: '@aella/build-typescript-esbuild/extract-dependencies',
      async setup(build) {
        const filesData = await readFiles(workspaceRootDir, (build.initialOptions.entryPoints as string[]) || []);
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
          if (cache.files[args.importer] && !isBuiltinModule(args.path)) {
            if (args.path.startsWith('.')) {
              resolvedDeps.add(path.resolve(path.dirname(args.importer), args.path));
            } else if (args.path.startsWith('//')) {
              resolvedDeps.add(path.resolve(workspaceRootDir, args.path.slice(2)));
            } else {
              resolvedDeps.add(args.path.match(EXTRACT_MODULE_NAME_RX)![0]);
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
