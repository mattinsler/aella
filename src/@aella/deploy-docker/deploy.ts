import fs from 'node:fs';
import path from 'node:path';

import { build } from '@aella/core';

import type { DeployOptions } from '@aella/core';

import { buildYarnLock } from './yarn-lock.js';
import { buildProjectJson } from './package-json.js';

export async function deploy({ project }: DeployOptions): Promise<void> {
  console.log('deploy');
  const { outputs } = await build(project, { deps: true });
  const projectJson = buildProjectJson(project);
  const yarnLock = buildYarnLock(project.workspace, projectJson.dependencies);

  console.log(projectJson);
  console.log(yarnLock);

  // create package.json
  // create yarn.lock
  // create Dockerfile
}
