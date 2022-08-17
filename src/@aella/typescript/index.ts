import path from 'node:path';

import { NodeModuleInfo } from '@aella/node';
import { DefaultInfo, builder, plugin } from '@aella/core';

import type { TypeScriptBuildConfig } from './build';

import { replaceExtension } from './utils.js';
import { isFileSupported } from './supported.js';

async function typescriptBuild(config: TypeScriptBuildConfig) {
  const { build } = await import('./build.js');
  return build(config);
}

const build = builder((context, { project, sources }) => {
  const inputs = sources.filter(isFileSupported);
  const outputs = inputs.map((file) => context.file(replaceExtension(file.path, '.js'), context.workspace.distDir));

  const tsconfig = context.file(path.join(project.name, 'tsconfig.json'), context.workspace.rootDir);

  context.action(
    typescriptBuild,
    {
      config: {
        files: inputs,
        outdir: context.workspace.distDir,
        outbase: context.workspace.rootDir,
        target: `node${process.version.slice(1)}`,
        tsconfig,
      },
      inputs,
      outputs,
    },
    'Build TypeScript'
  );

  return [DefaultInfo({ files: outputs }), NodeModuleInfo({ moduleNames: project.dependencies.build })];
});

export default plugin((ctx) => {
  ctx.onWorkspaceConfig((config) => {
    config.addBuilder({
      build,
      extractDependencies: async (...args) => (await import('./extract-dependencies.js')).extractDependencies(...args),
      name: '@aella/typescript',
    });
  });
});
