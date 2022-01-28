import fs from 'fs';
import path from 'path';
import esbuild from 'esbuild';
import JSONC from 'jsonc-parser';

import type task from 'tasuku';
import type { BuildContext } from './types.js';

import { glob } from '../../glob.js';
import { plugin } from './esbuild-plugin.js';
import { copyAssets } from '../../copy-assets.js';

async function buildProject({
  project,
  tsconfig,
  workspace,
}: BuildContext & {
  tsconfig: string;
}) {
  const start = Date.now();

  const [pkg, projectFiles] = await Promise.all([
    (async () => JSONC.parse(await fs.promises.readFile(path.join(workspace.rootDir, 'package.json'), 'utf-8')))(),
    glob(project.rootDir, ['**/*.ts', '**/*.js'], {
      exclude: workspace.project.ignore,
    }),
  ]);

  const external = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
    ...Object.keys(pkg.optionalDependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
  ];

  const buildOpts: esbuild.BuildOptions = {
    format: 'esm',
    outdir: workspace.distDir,
    outbase: workspace.rootDir,
    platform: 'node',
    target: `node${process.version.slice(1)}`,
    tsconfig,
  };

  const { metafile } = await esbuild.build({
    ...buildOpts,
    bundle: true,
    entryPoints: projectFiles,
    external,
    metafile: true,
    write: false,
  });

  const files = Object.keys(metafile!.inputs);

  const res = await esbuild.build({
    ...buildOpts,
    entryPoints: files,
    metafile: true,
    plugins: [plugin(project.rootDir)],
    sourcemap: 'inline',

    write: true,
  });

  const end = Date.now();

  return {
    emittedFiles: Object.keys(res.metafile!.outputs),
    success: true,
    totalTime: ((end - start) / 1000).toFixed(2),
  };
}

export async function build({ project, taskHelpers, workspace }: BuildContext & { taskHelpers?: task.TaskInnerApi }) {
  const tsconfig = path.join(project.rootDir, 'tsconfig.json');

  if (taskHelpers) {
    const { task } = taskHelpers;
    await task(`esbuild ${tsconfig}`, async ({ setError, setStatus, setOutput }) => {
      const { emittedFiles, success, totalTime } = await buildProject({
        project,
        tsconfig,
        workspace,
      });
      if (success) {
        emittedFiles.push(...(await copyAssets({ project, workspace })));
        setStatus(`${totalTime}s`);
        setOutput(`Emitted ${emittedFiles.length} file(s):\n${emittedFiles.map((s) => `  ${s}`).join('\n')}`);
      } else {
        setError('');
        setStatus(`${totalTime}s`);
        // setOutput(errors.join('\n'));
      }
    });
  } else {
    await buildProject({ project, tsconfig, workspace });
  }
}
