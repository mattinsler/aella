import { dirname, extname, join, relative } from 'node:path';

export interface File {
  readonly path: string;
  readonly root: string;

  readonly absolutePath: string;
  readonly absoluteDirectory: string;
  readonly directory: string;
  readonly extension: string;

  readonly isDirectory: boolean;

  pathRelativeTo(root: string): string;
}

export interface Directory extends File {
  readonly isDirectory: true;
}

export function createFile(path: string, root: string, isDirectory: true): Directory;
export function createFile(path: string, root: string, isDirectory?: false): File;
export function createFile(path: string, root: Directory): File;
export function createFile(file: File, root: string): File;
export function createFile(file: File, dir: Directory): File;
export function createFile(file: Directory, root: string): Directory;
export function createFile(
  pathOrFileOrDirectory: string | File | Directory,
  rootOrDirectory: string | Directory,
  isDirectory: boolean = false
): File {
  const path = typeof pathOrFileOrDirectory === 'string' ? pathOrFileOrDirectory : pathOrFileOrDirectory.path;
  const root = typeof rootOrDirectory === 'string' ? rootOrDirectory : rootOrDirectory.absolutePath;

  if (typeof pathOrFileOrDirectory !== 'string' && pathOrFileOrDirectory.isDirectory) {
    isDirectory = true;
  }

  return Object.freeze({
    path,
    root,

    get absolutePath() {
      return join(root, path);
    },

    get absoluteDirectory() {
      return dirname(join(root, path));
    },

    get directory() {
      return dirname(path);
    },

    get extension() {
      return extname(path);
    },

    isDirectory,

    pathRelativeTo(newRoot: string): string {
      if (root === newRoot) {
        return path;
      }
      return relative(newRoot, join(root, path));
    },
  });
}

export function createDirectory(path: string, root: string): Directory {
  return createFile(path, root, true);
}
