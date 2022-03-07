import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import getValue from 'get-value';
import { execaCommand } from 'execa';

import type { TargetConfig, WorkspaceConfig } from '../types.js';

import { npmPackager } from './npm-packager.js';
import { typescriptBuilder } from '../builders/typescript-builder/index.js';

export const dockerPackager = {
  async package({ target, workspace }: { target: TargetConfig; workspace: WorkspaceConfig }) {
    await typescriptBuilder.build({ project: target.project, workspace });
    const pkgDir = await npmPackager.package({ target, workspace });

    const nodeVersion = (await fs.promises.readFile(path.join(pkgDir, '.node-version'), 'utf-8')).trim();

    await fs.promises.writeFile(
      path.join(pkgDir, 'Dockerfile'),
      [
        `FROM node:${nodeVersion}-alpine`,

        'WORKDIR /usr/src/app',

        'ADD package.json ./',
        'ADD yarn.lock ./',

        'RUN yarn install --frozen-lockfile',

        'COPY . .',

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

    const buildCommandSegments: string[] = [];

    if (process.arch === 'x64') {
      buildCommandSegments.push('docker build');
    } else {
      console.log(`** Using docker buildx ** (https://docs.docker.com/buildx/working-with-buildx/)`);
      const arch = ['linux/amd64', process.arch === 'arm64' && 'linux/arm64'].filter(Boolean);
      buildCommandSegments.push(`docker buildx build --platform ${arch.join(',')}`);
    }

    if (repository) {
      if (registry) {
        buildCommandSegments.push('-t', `${registry}/${repository}:${target.name}`);
        console.log(`Building and pushing ${registry}/${repository}:${target.name}`);
      } else {
        buildCommandSegments.push('-t', `${repository}:${target.name}`);
        console.log(`Building and pushing ${repository}:${target.name}`);
      }
      buildCommandSegments.push('--push');
    } else {
      buildCommandSegments.push('-t', `${target.project.name}:${target.name}`);
      console.log(`Building and tagging ${target.project.name}:${target.name}`);
    }

    buildCommandSegments.push('-');

    await execaCommand(buildCommandSegments.join(' '), {
      cwd: pkgDir,
      input: fs.createReadStream(tmpfile),
      stderr: 'inherit',
      stdout: 'inherit',
    });
  },
};
