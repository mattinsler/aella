import S from 'fluent-json-schema';

import { deploy } from './deploy.js';
export { deploy };

import type { Plugin } from '@aella/core';

export const plugin: Plugin = (ctx) => {
  ctx.onWorkspaceConfig((config) => {
    config.deployers.push({
      deploy,
      name: '@aella/deploy-docker',
    });

    config.schemas.project.deploySchemas.push(
      S.string().enum(['@aella/deploy-docker']),
      S.object()
        .prop('type', S.string().enum(['@aella/deploy-docker']))
        .prop('repository', S.string())
        .prop('registry', S.string())
    );

    // defaults....
    // config.schemas.workspace.
  });
};
