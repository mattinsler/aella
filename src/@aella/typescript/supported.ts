import type { File } from '@aella/core';

import { LOADERS } from './loaders.js';

export const SUPPORTED_EXTENSIONS = new Set(Object.keys(LOADERS));

export function isFileSupported(file: File) {
  return SUPPORTED_EXTENSIONS.has(file.extension) && !file.path.endsWith('.d.ts');
}
