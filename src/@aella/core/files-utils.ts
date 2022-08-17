import fs from 'node:fs';

import type { File } from './types';

export async function mkdirs(files: Iterable<File>) {
  const dirs = new Set<string>();

  for (const file of files) {
    dirs.add(file.absoluteDirectory);
  }

  const promises: Promise<unknown>[] = [];

  for (const dir of dirs) {
    promises.push(fs.promises.mkdir(dir, { recursive: true }));
  }

  await Promise.all(promises);
}
