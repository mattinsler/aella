import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import getValue from 'get-value';
import { execaCommand } from 'execa';

import type { TargetConfig, WorkspaceConfig } from '../types.js';

import { npmPackager } from './npm-packager.js';
import { typescriptBuilder } from '../builders/typescript-builder/index.js';

interface DockerBuildOptions {
  dir: string;
  layerFile: string;
  push: boolean;
  tag: string;
}

async function dockerBuild({ dir, layerFile, push, tag }: DockerBuildOptions) {
  await execaCommand(`docker build -t ${tag} -`, {
    cwd: dir,
    input: fs.createReadStream(layerFile),
    stderr: 'inherit',
    stdout: 'inherit',
  });

  if (push) {
    await execaCommand(`docker push ${tag}`, {
      cwd: dir,
      stderr: 'inherit',
      stdout: 'inherit',
    });
  }
}

async function dockerBuildx({ dir, layerFile, push, tag }: DockerBuildOptions) {
  console.log(`** Using docker buildx ** (https://docs.docker.com/buildx/working-with-buildx/)`);
  const arch = ['linux/amd64', process.arch === 'arm64' && 'linux/arm64'].filter(Boolean);

  await execaCommand(`docker buildx build --platform ${arch.join(',')} -t ${tag} ${push ? '--push' : ''} -`, {
    cwd: dir,
    input: fs.createReadStream(layerFile),
    stderr: 'inherit',
    stdout: 'inherit',
  });
}

export const dockerPackager = {
  async package({ target, workspace }: { target: TargetConfig; workspace: WorkspaceConfig }) {
    await typescriptBuilder.build({ project: target.project, workspace });
    const pkgDir = await npmPackager.package({ target, workspace });

    const nodeVersion = (await fs.promises.readFile(path.join(pkgDir, '.node-version'), 'utf-8')).trim();

    await fs.promises.writeFile(
      path.join(pkgDir, 'Dockerfile'),
      [
        `FROM node:${nodeVersion}-alpine AS deps`,

        'WORKDIR /usr/src/app',

        'ADD package.json ./',
        'ADD yarn.lock ./',

        'RUN apk --no-cache --update add alpine-sdk python3-dev',
        'RUN yarn install --frozen-lockfile',

        `FROM node:${nodeVersion}-alpine`,

        'WORKDIR /usr/src/app',

        'COPY . .',
        'COPY --from=deps /usr/src/app/node_modules ./node_modules',

        'ENV NODE_ENV production',

        'ENTRYPOINT [ "node", "index.js" ]',
      ].join(os.EOL)
    );

    const tmpfile = path.join(os.tmpdir(), crypto.randomBytes(16).toString('hex') + '.tgz');
    await execaCommand(`tar -czhf ${tmpfile} .`, {
      cwd: pkgDir,
    });

    const registry =
      getValue(target.project.options, 'package.container.registry') ||
      getValue(workspace, 'package.container.registry');
    const repository = getValue(target.project.options, 'package.container.repository');

    let tag;

    if (repository) {
      tag = registry ? `${registry}/${repository}:${target.name}` : `${repository}:${target.name}`;
    } else {
      tag = `${target.project.name}:${target.name}`;
    }

    console.log(`Building ${!!repository ? 'and pushing ' : ''}${tag}`);
    if (process.arch === 'x64') {
      await dockerBuild({
        dir: pkgDir,
        layerFile: tmpfile,
        push: !!repository,
        tag,
      });
    } else {
      await dockerBuildx({
        dir: pkgDir,
        layerFile: tmpfile,
        push: !!repository,
        tag,
      });
    }
  },
};
