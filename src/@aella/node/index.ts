import path from 'node:path';
import { DefaultInfo, bundler, plugin } from '@aella/core';

import type { File } from '@aella/core';

import type { NodeBundleConfig } from './bundle';

import { NodeModuleInfo } from './providers.js';
export { NodeModuleInfo };

async function nodeBundle(config: NodeBundleConfig) {
  const { bundle } = await import('./bundle.js');
  return bundle(config);
}

function replaceExtension(file: string, desiredExtension: string) {
  if (!desiredExtension.startsWith('.')) {
    desiredExtension = `.${desiredExtension}`;
  }

  const ext = path.extname(file);
  return file.slice(0, -ext.length) + desiredExtension;
}

interface BundlerConfig {
  entry: string;
}

const bundle = bundler<BundlerConfig>((context, { config, data, target }) => {
  const bundleDirectory = context.directory(
    path.join(target.project.name, `${target.name}.node_bundle`),
    context.workspace.distDir
  );

  const files = DefaultInfo.files(data);

  const entry = replaceExtension(path.join(target.project.name, config.entry), '.js');
  if (!files.some((file) => file.path === entry)) {
    throw new Error(`Cannot find the entry file "${config.entry}" in project "${target.project.name}".`);
  }

  const nodeModuleInfo = NodeModuleInfo.aggregate([
    ...data,
    ...(target.project.test ? [NodeModuleInfo({ moduleNames: ['jest'] })] : []),
  ]);

  const links = [
    ...files,
    ...nodeModuleInfo.moduleNames.map((name) =>
      context.directory(path.join('node_modules', name), context.workspace.rootDir)
    ),
  ].map((to) => ({ from: context.file(to, bundleDirectory), to }));

  const packageJson = context.file('package.json', context.workspace.rootDir);
  const yarnLock = context.file('yarn.lock', context.workspace.rootDir);

  const inputs = [...links.map(({ from }) => from), packageJson, yarnLock];

  const executables: File[] = [context.file('entry.sh', bundleDirectory)];
  const outputs = [...links.map(({ to }) => to), ...executables];

  context.action(
    nodeBundle,
    {
      config: {
        entry,
        links,
        packageJson,
        yarnLock,
        outputRoot: bundleDirectory.absolutePath,
        name: target.name,
        nodeModules: nodeModuleInfo.moduleNames,
      },
      inputs,
      outputs,
    },
    'Bundle Node'
  );

  return [DefaultInfo({ executables, files: outputs })];
});

export default plugin((ctx) => {
  ctx.onWorkspaceConfig((config, S) => {
    config.addBundler({
      name: '@aella/node',
      bundle,
      configSchema: S.object().prop('entry', S.string().required()),
    });
  });
});
