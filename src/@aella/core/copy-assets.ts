import fs from 'fs';

import type { File, Kernel, Provider } from './types';

import { DefaultInfo } from './default-info.js';

async function copyFiles({ copies }: { copies: Array<{ from: File; to: File }> }) {
  const dirs = new Set(copies.map(({ to }) => to.absoluteDirectory));
  await Promise.all(Array.from(dirs).map((dir) => fs.promises.mkdir(dir, { recursive: true })));
  await Promise.all(copies.map(({ from, to }) => fs.promises.copyFile(from.absolutePath, to.absolutePath)));
}

export async function copyAssets(
  kernel: Kernel,
  {
    files,
  }: {
    files: { assets: File[] };
  }
): Promise<Provider[]> {
  const inputs = files.assets;
  const outputs = inputs.map((asset) => kernel.file(asset.path, kernel.workspace.distDir));

  kernel.task(
    copyFiles,
    {
      config: {
        copies: inputs.map((input, idx) => ({ from: input, to: outputs[idx] })),
      },
      inputs: files.assets,
      outputs: outputs,
    },
    'Copy Assets'
  );

  return [DefaultInfo({ files: outputs })];
}
