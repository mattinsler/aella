import fs from 'fs';
import path from 'path';
import esbuild from 'esbuild';
import { parse } from 'es-module-lexer';
import builtinModules from 'builtin-modules';
import { createMatchPath, loadConfig } from 'tsconfig-paths';

const BUILTIN_MODULES = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);

const LOADERS: Record<string, esbuild.Loader> = {
  '.js': 'js',
  '.cjs': 'js',
  '.mjs': 'js',
  '.jsx': 'jsx',
  '.ts': 'ts',
  '.cts': 'ts',
  '.mts': 'ts',
  '.tsx': 'tsx',
};

const FILE_PREFIX_RX = new RegExp(
  `\.(${Object.keys(LOADERS)
    .map((ext) => ext.slice(1))
    .join('|')})$`
);

const INDEX_FILES = new Set(Object.keys(LOADERS).map((ext) => `index${ext}`));

function lightweightResolve(file: string) {
  const stat = fs.statSync(file, { throwIfNoEntry: false });
  if (stat && stat.isDirectory()) {
    const files = fs.readdirSync(file);
    if (files.find((f) => INDEX_FILES.has(f))) {
      return path.join(file, 'index.js');
    }
  }

  const base = `${path.basename(file)}.`;
  const files = fs.readdirSync(path.dirname(file));
  if (files.find((f) => f.startsWith(base))) {
    return `${file}.js`;
  }

  throw new Error(`Cannot find the source file associate with ${file}.`);
}

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

function ensureEsmImportsMiddleware(rootDir: string): Middleware {
  return ({ contents, file }) => {
    const [imports] = parse(contents);
    const replacements: { start: number; end: number; value: string }[] = [];

    imports.forEach(({ n, s, e }) => {
      if (n && n.startsWith('.') && !n.endsWith('.js')) {
        const ext = path.extname(n);
        if (!ext || !!LOADERS[ext]) {
          const resolvedFile = lightweightResolve(path.resolve(path.dirname(file), n));
          const value = path.relative(path.dirname(file), resolvedFile);
          replacements.push({ start: s, end: e, value });
        }
      }
    });

    return replaceAll(contents, replacements);
  };
}

function transformTsconfigPathsMiddleware(rootDir: string): Middleware {
  const loadConfigRes = loadConfig(rootDir);
  if (loadConfigRes.resultType === 'failed') {
    throw new Error();
  }

  const matchPath = createMatchPath(
    loadConfigRes.absoluteBaseUrl,
    loadConfigRes.paths,
    loadConfigRes.mainFields,
    loadConfigRes.addMatchAll
  );

  const extensions = Object.keys(LOADERS);

  return ({ contents, file }) => {
    const [imports] = parse(contents);
    const replacements: { start: number; end: number; value: string }[] = [];

    imports.forEach(({ n, s, e }) => {
      if (n && !BUILTIN_MODULES.has(n)) {
        const ext = path.extname(n);
        const importPath = LOADERS[ext] ? n.slice(0, -ext.length) : n;
        const match = matchPath(importPath, undefined, undefined, extensions);
        if (match) {
          const value = path.relative(path.dirname(file), match);
          replacements.push({ start: s, end: e, value });
        }
      }
    });

    return replaceAll(contents, replacements);
  };
}

export function plugin(rootDir: string): esbuild.Plugin {
  const middleware = [transformTsconfigPathsMiddleware(rootDir), ensureEsmImportsMiddleware(rootDir)];

  return {
    name: 'aella-plugin',
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
