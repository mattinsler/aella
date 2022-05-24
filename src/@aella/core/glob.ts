import { fdir } from 'fdir';
import path from 'node:path';
import nanomatch from 'nanomatch';

import type { ExcludeFn, FilterFn } from 'fdir';

function toExcludeDirectoryMatcher(dir: string, patterns: string[]) {
  patterns = patterns.map((pattern) => {
    if (!pattern.endsWith('/')) {
      pattern = pattern + '/';
    }

    if (pattern.startsWith('/')) {
      return path.join(dir, pattern);
    }

    return path.join(dir, '**', pattern);
  });

  const matcher = nanomatch.matcher(patterns);

  return (_dirName: string, dirPath: string): boolean => {
    return matcher(dirPath);
  };
}

function toFilterFileMatcher(dir: string, patterns: string[]) {
  patterns = patterns.map((pattern) => {
    if (pattern.startsWith('/')) {
      return path.join(dir, pattern);
    }

    return path.join(dir, '**', pattern);
  });

  const matcher = nanomatch.matcher(patterns);

  return (filePath: string, isDirectory: boolean): boolean => {
    return !isDirectory && matcher(filePath);
  };
}

function toFilterDirectoryMatcher(dir: string, patterns: string[]) {
  patterns = patterns.map((pattern) => {
    if (!pattern.endsWith('/')) {
      pattern = pattern + '/';
    }

    if (pattern.startsWith('/')) {
      return path.join(dir, pattern);
    }

    return path.join(dir, '**', pattern);
  });

  const matcher = nanomatch.matcher(patterns);

  return (filePath: string, isDirectory: boolean): boolean => {
    return isDirectory && matcher(filePath);
  };
}

export interface GlobOptions {
  include?: {
    directories?: string[];
    files?: string[];
  };
  exclude?: {
    directories?: string[];
    files?: string[];
  };
}

export function glob(dir: string, options: GlobOptions) {
  let api = new fdir().withBasePath().withFullPaths();

  const excludeFunctions: ExcludeFn[] = [];
  const filterFunctions: FilterFn[] = [];

  function addExcludeFunction(fn: ExcludeFn) {
    excludeFunctions.push(fn);
    if (excludeFunctions.length === 1) {
      api = api.exclude((dirName, dirPath) => {
        return excludeFunctions.some((fn) => fn(dirName, dirPath));
      });
    }
  }
  function addFilterFunction(fn: FilterFn) {
    filterFunctions.push(fn);
    if (filterFunctions.length === 1) {
      api = api.filter((path, isDirectory) => {
        return filterFunctions.some((fn) => fn(path, isDirectory));
      });
    }
  }

  if (options.exclude && options.exclude.directories) {
    addExcludeFunction(toExcludeDirectoryMatcher(dir, options.exclude.directories));
  }

  // if (options.exclude.files) {
  //   const excludeFiles = toFileMatcher(options.exclude.files);
  //   api = api.filter((filePath, isDirectory) => !excludeFiles(filePath, isDirectory));
  // }

  if (options.include && options.include.files) {
    addFilterFunction(toFilterFileMatcher(dir, options.include.files));
  }
  if (options.include && options.include.directories) {
    api = api.withDirs();
    addFilterFunction(toFilterDirectoryMatcher(dir, options.include.directories));
  }

  // if (opts.exclude) {
  //   if (opts.exclude.dirname && opts.exclude.dirname.length > 0) {
  //     const excludeDirs = new Set(opts.exclude.dirname);
  //     api = api.exclude((dirname) => excludeDirs.has(dirname));
  //   }
  //   if (opts.exclude.filename && opts.exclude.filename.length > 0) {
  //     const excludedFilenames = new Set(opts.exclude.filename);
  //     api = api.filter((filePath, isDirectory) => !isDirectory && !excludedFilenames.has(path.basename(filePath)));
  //   }
  // }

  // if (typeof include === 'string' || Array.isArray(include)) {
  //   api = api.glob(...([] as string[]).concat(include));
  // } else {
  //   const includedFilenames = new Set(([] as string[]).concat(include.filename));
  //   api = api.filter((filePath, isDirectory) => !isDirectory && includedFilenames.has(path.basename(filePath)));
  // }

  dir = dir.replace(/\/+$/, '');

  const globber = {
    exclude(fn: ExcludeFn) {
      addExcludeFunction(fn);
      return globber;
    },
    filter(fn: FilterFn) {
      addFilterFunction(fn);
      return globber;
    },

    async async({ relative }: { relative?: boolean } = {}): Promise<string[]> {
      const files = (await api.crawl(dir).withPromise()) as string[];
      if (relative) {
        const prefixLength = dir.length + 1;
        return files.map((file) => file.slice(prefixLength));
      }
      return files;
    },
    sync({ relative }: { relative?: boolean } = {}): string[] {
      const files = api.crawl(dir).sync() as string[];
      if (relative) {
        const prefixLength = dir.length + 1;
        return files.map((file) => file.slice(prefixLength));
      }
      return files;
    },
  };

  return globber;
}
