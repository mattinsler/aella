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

    await execaCommand(`docker build -t ${target.project.name}:${target.name} -`, {
      cwd: pkgDir,
      input: fs.createReadStream(tmpfile),
      stderr: 'inherit',
      stdout: 'inherit',
    });

    const registry =
      getValue(target.project.options, 'package.docker.registry') || getValue(workspace, 'package.container.registry');
    const repository = getValue(target.project.options, 'package.docker.repository');
    if (repository) {
      const tag = registry ? `${registry}/${repository}:${target.name}` : `${repository}:${target.name}`;
      console.log(`Tagging ${tag}`);
      await execaCommand(`docker tag ${target.project.name}:${target.name} ${tag}`);
    }
  },
};
