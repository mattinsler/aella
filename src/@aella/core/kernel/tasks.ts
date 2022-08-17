// import tar from 'tar';
// import fs from 'node:fs';
// import path from 'node:path';
// import crypto from 'node:crypto';
// import objectHash from 'object-hash';

// import type { File, WorkspaceConfig } from '../types';

// async function hashTaskInput(opts: { config: any; inputs: File[]; outputs: File[]; workspace: WorkspaceConfig }) {
//   const hash = crypto.createHash('sha256');

//   hash.update(
//     objectHash(opts.config, {
//       encoding: 'buffer',
//     })
//   );

//   const inputs = opts.inputs
//     .map((input) => ({ file: input, path: input.pathFromRoot(opts.workspace.rootDir) }))
//     .sort((l, r) => l.path.localeCompare(r.path));
//   const outputs = opts.outputs
//     .map((input) => ({ file: input, path: input.pathFromRoot(opts.workspace.distDir) }))
//     .sort((l, r) => l.path.localeCompare(r.path));

//   const inputHashes = await Promise.all(inputs.map(({ file }) => file.hash()));
//   inputs.forEach((input, index) => {
//     hash.update(input.path);
//     hash.update(inputHashes[index]);
//   });

//   outputs.forEach((output) => {
//     hash.update(output.path);
//   });

//   return hash.digest();
// }

// async function writeOutputsToFile(opts: { cacheFilePath: string; outputs: OutputFile[]; rootDir: string }) {
//   await tar.create(
//     {
//       cwd: opts.rootDir,
//       gzip: true,
//       file: opts.cacheFilePath,
//       follow: true,
//       portable: true,
//     },
//     opts.outputs.map((output) => output.pathFromRoot(opts.rootDir))
//   );
// }

// async function writeOutputsFromFile(opts: { cacheFilePath: string; outputs: OutputFile[]; rootDir: string }) {
//   await tar.extract({
//     cwd: opts.rootDir,
//     file: opts.cacheFilePath,
//     // check output files to make sure only the ones expected are extracted?
//   });
// }

// export async function task(
//   workspace: WorkspaceConfig,
//   { config, inputs, outputs }: { config: any; inputs: ReadableFile[]; outputs: OutputFile[] },
//   fn: () => Promise<void>
// ): Promise<void> {
//   const taskCacheDir = path.join(workspace.rootDir, '.cache', 'tasks');

//   // validate inputs are within workspace.rootDir
//   // validate that outputs are within workspace.distDir

//   const hash = await hashTaskInput({
//     config: {
//       system: {
//         // aella version
//         // plugin version?
//         // applicable environment variables?
//       },
//       task: config,
//     },
//     inputs,
//     outputs,
//     workspace,
//   });

//   const cacheFilePath = path.join(taskCacheDir, `${hash}.tgz`);

//   if (fs.existsSync(cacheFilePath)) {
//     try {
//       await writeOutputsFromFile({
//         cacheFilePath,
//         outputs,
//         rootDir: workspace.distDir,
//       });
//     } catch (err) {
//       console.error(err);
//     }
//   }

//   await fn();
//   await writeOutputsToFile({
//     cacheFilePath,
//     outputs,
//     rootDir: workspace.distDir,
//   });
// }
