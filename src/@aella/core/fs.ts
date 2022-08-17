import FSPromises from 'node:fs/promises';

interface FileSystem {
  mkdir: typeof FSPromises.mkdir;
  readFile: typeof FSPromises.readFile;
  rm: typeof FSPromises.rm;
  symlink: typeof FSPromises.symlink;
  writeFile: typeof FSPromises.writeFile;
}

export const fs = {
  mkdir: FSPromises.mkdir,
  readFile: FSPromises.readFile,
  rm: FSPromises.rm,
  symlink: async (target, path, type) => {
    try {
      await FSPromises.symlink(target, path, type);
    } catch (err) {
      if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'EEXIST') {
        if (target !== (err as any as { path: string }).path) {
          throw new Error(`Trying to symlink "${path}" to a different path.`);
        }
      } else {
        throw err;
      }
    }
  },
  writeFile: FSPromises.writeFile,
} as FileSystem;
