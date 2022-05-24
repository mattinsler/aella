import path from 'node:path';

export function replaceExtension(file: string, desiredExtension: string) {
  if (!desiredExtension.startsWith('.')) {
    desiredExtension = `.${desiredExtension}`;
  }

  const ext = path.extname(file);
  return file.slice(0, -ext.length) + desiredExtension;
}
