import fs from 'fs';
import path from 'path';
import esbuild from 'esbuild';
import isBuiltinModule from 'is-builtin-module';
import { createMatchPath, loadConfig } from 'tsconfig-paths';

import { resolve } from './resolve.js';
import { LOADERS } from './loaders.js';
import { parseImportsWithLocation } from './parse-imports.js';

const SUPPORTED_EXTENSIONS = new Set(Object.keys(LOADERS));

const FILE_PREFIX_RX = new RegExp(
  `\.(${Object.keys(LOADERS)
    .map((ext) => ext.slice(1))
    .join('|')})$`
);

function replaceAll(original: string, replacements: { start: number; end: number; value: string }[]): string {
  if (replacements.length === 0) {
    return original;
  }

  let diff = 0;
  let modified = original;

  replacements.forEach(({ start, end, value }) => {
    const before = modified.slice(0, start + diff);
    const after = modified.slice(end + diff);
    modified = [before, value, after].join('');
    diff += value.length - (end - start);
  });

  return modified;
}

type Middleware = (opts: { contents: string; file: string }) => string;

function ensureEsmImportsMiddleware(_rootDir: string): Middleware {
  return ({ contents, file }) => {
    const imports = parseImportsWithLocation(contents, file);
    const replacements: { start: number; end: number; value: string }[] = [];

    imports.forEach(({ end, start, value }) => {
      if (value.startsWith('.') && !value.endsWith('.js')) {
        const ext = path.extname(value);
        if (!ext || !!LOADERS[ext]) {
          const resolvedFile = resolve(value, {
            basedir: path.dirname(file),
            extensions: Array.from(SUPPORTED_EXTENSIONS),
          });
          const newValue = path.relative(path.dirname(file), resolvedFile);
          replacements.push({ start, end, value: newValue });
        }
      }
    });

    return replaceAll(contents, replacements);
  };
}

function transformTsconfigPathsMiddleware(rootDir: string): Middleware {
  const loadConfigRes = loadConfig(rootDir);
  if (loadConfigRes.resultType === 'failed') {
    throw new Error(`Cannot load tsconfig from ${rootDir}: ${loadConfigRes.message}`);
  }

  const matchPath = createMatchPath(
    loadConfigRes.absoluteBaseUrl,
    loadConfigRes.paths,
    loadConfigRes.mainFields,
    loadConfigRes.addMatchAll
  );

  const extensions = Array.from(SUPPORTED_EXTENSIONS);

  return ({ contents, file }) => {
    const imports = parseImportsWithLocation(contents, file);
    const replacements: { start: number; end: number; value: string }[] = [];

    imports.forEach(({ end, start, value }) => {
      if (!isBuiltinModule(value)) {
        const ext = path.extname(value);
        const importPath = LOADERS[ext] ? value.slice(0, -ext.length) : value;
        const match = matchPath(importPath, undefined, undefined, extensions);
        if (match) {
          const newValue = path.relative(path.dirname(file), match);
          replacements.push({ start, end, value: newValue });
        }
      }
    });

    return replaceAll(contents, replacements);
  };
}

export function plugin(rootDir: string): esbuild.Plugin {
  const middleware = [transformTsconfigPathsMiddleware(rootDir), ensureEsmImportsMiddleware(rootDir)];

  return {
    name: '@aella/typescript/build',
    setup(build) {
      build.onLoad({ filter: FILE_PREFIX_RX }, async (args) => {
        const file = args.path;
        const original = await fs.promises.readFile(file, 'utf-8');

        const contents = middleware.reduce((contents, m) => m({ contents, file }), original);

        return {
          contents,
          loader: LOADERS[path.extname(file)],
        };
      });
    },
  };
}
