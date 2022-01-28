import path from 'path';
import { fdir } from 'fdir';

export function createGlob(
  include: string | string[] | { filename: string | string[] },
  opts: { exclude?: { dirname?: string[]; filename?: string[] } } = {}
) {
  let api = new fdir().withBasePath().withFullPaths();

  if (opts.exclude) {
    if (opts.exclude.dirname && opts.exclude.dirname.length > 0) {
      const excludeDirs = new Set(opts.exclude.dirname);
      api = api.exclude((dirname) => excludeDirs.has(dirname));
    }
    if (opts.exclude.filename && opts.exclude.filename.length > 0) {
      const excludedFilenames = new Set(opts.exclude.filename);
      api = api.filter((filePath, isDirectory) => !isDirectory && !excludedFilenames.has(path.basename(filePath)));
    }
  }

  if (typeof include === 'string' || Array.isArray(include)) {
    api = api.glob(...([] as string[]).concat(include));
  } else {
    const includedFilenames = new Set(([] as string[]).concat(include.filename));
    api = api.filter((filePath, isDirectory) => !isDirectory && includedFilenames.has(path.basename(filePath)));
  }

  return function glob(dir: string): Promise<string[]> {
    return api.crawl(dir).withPromise() as Promise<string[]>;
  };
}

export function glob(
  dir: string,
  include: string | string[] | { filename: string | string[] },
  opts: { exclude?: { dirname?: string[]; filename?: string[] } } = {}
) {
  return createGlob(include, opts)(dir);
}
