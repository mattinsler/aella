import fs from 'node:fs';
import path from 'node:path';
import Docker from 'dockerode';

import { build } from '@aella/core';

import type { DeployOptions } from '@aella/core';

import { buildYarnLock } from './yarn-lock.js';
import { buildPackageJson } from './package-json.js';

async function isDockerIsRunning(docker: Docker) {
  try {
    await docker.version();
    return true;
  } catch (err) {
    if (err && (err as any).code === 'ECONNREFUSED') {
      return true;
    }
    throw err;
  }
}

async function buildSandbox({
  sandboxDir,
  targetFiles,
  workspaceDistDir,
}: {
  sandboxDir: string;
  targetFiles: string[];
  workspaceDistDir: string;
}) {
  const dirs = Array.from(new Set(targetFiles.map(path.dirname))).sort();
  await Promise.all(dirs.map((dir) => fs.promises.mkdir(path.join(sandboxDir, dir), { recursive: true })));
  await Promise.all(
    targetFiles.map((file) =>
      fs.promises.symlink(
        path.join(workspaceDistDir, file),
        //
        path.join(sandboxDir, file)
      )
    )
  );
}

export async function deploy({ project, target }: DeployOptions): Promise<void> {
  if (!target) {
    throw new Error(`You must use @aella/deploy-docker with an executable target, not just a project.`);
  }

  // const docker = new Docker();
  // if (!(await isDockerIsRunning(docker))) {
  //   throw new Error(`Docker is not currently running. Start docker and retry this command.`);
  // }

  const { inputs, outputs } = await build(project, { deps: true });
  const entryIndex = inputs.indexOf(path.join(project.name, target.entry));
  if (entryIndex === -1) {
    throw new Error(`Cannot find target entry file in build inputs (${path.join(project.name, target.entry)}).`);
  }

  const sandboxDir = path.join(project.distDir, `${target.name}.docker`);
  await fs.promises.rm(sandboxDir, { force: true, recursive: true });

  await buildSandbox({
    sandboxDir,
    targetFiles: outputs,
    workspaceDistDir: project.workspace.distDir,
  });

  const packageJson = buildPackageJson(project);
  const yarnLock = buildYarnLock(project.workspace, packageJson.dependencies);

  packageJson.name = target.name;
  packageJson.private = true;

  packageJson.main = outputs[entryIndex];

  await Promise.all([
    fs.promises.writeFile(path.join(sandboxDir, 'package.json'), JSON.stringify(packageJson, null, 2), 'utf-8'),
    fs.promises.writeFile(path.join(sandboxDir, 'yarn.lock'), yarnLock, 'utf-8'),
    fs.promises.writeFile(
      path.join(sandboxDir, 'Dockerfile'),
      [
        `FROM node:${process.versions.node}-alpine`,

        'WORKDIR /usr/src/app',

        'ADD package.json ./',
        'ADD yarn.lock ./',

        'RUN yarn install --frozen-lockfile',

        'COPY . .',

        `ENTRYPOINT [ "node", "${packageJson.main}" ]`,
      ].join('\n'),
      'utf-8'
    ),
  ]);
}
