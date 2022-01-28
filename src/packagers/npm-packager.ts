import fs from 'fs';
import path from 'path';
import esbuild from 'esbuild';
import JSONC from 'jsonc-parser';
import lockfile from '@yarnpkg/lockfile';

import type { TargetConfig, WorkspaceConfig } from '../types.js';

import { pruneLockfile } from './prune-lockfile.js';
import { copyTargetAssetsTo } from '../copy-assets.js';

const EXTRACT_MODULE_NAME_RX = /(@[^\/]+\/)?[^\/]+/;

export const npmPackager = {
  async package({ target, workspace }: { target: TargetConfig; workspace: WorkspaceConfig }) {
    const modules = new Set<string>();

    const { metafile } = await esbuild.build({
      bundle: true,
      entryPoints: [
        path.join(
          workspace.distDir,
          path.relative(workspace.rootDir, target.project.rootDir),
          target.entry.replace(/\.[^\.]+$/, '.js')
        ),
      ],
      format: 'esm',
      metafile: true,
      platform: 'node',
      plugins: [
        {
          name: 'extract-deps',
          setup(build) {
            build.onResolve({ filter: /^[^\.\/]/ }, (args) => {
              modules.add(args.path.match(EXTRACT_MODULE_NAME_RX)![0]);
              return {
                external: true,
              };
            });
          },
        },
      ],
      target: `node${process.version.slice(1)}`,
      write: false,
    });

    const files = Object.keys(metafile!.outputs[Object.keys(metafile!.outputs)[0]].inputs);

    const pkg = JSONC.parse(await fs.promises.readFile(path.join(workspace.rootDir, 'package.json'), 'utf-8'));
    const { dependencies, devDependencies, optionalDependencies, peerDependencies } = pkg;

    const deps = [
      ...Object.keys(dependencies || {}),
      ...Object.keys(devDependencies || {}),
      ...Object.keys(optionalDependencies || {}),
      ...Object.keys(peerDependencies || {}),
    ]
      .filter((dep) => modules.has(dep))
      .reduce<Record<string, string>>((o, dep) => {
        o[dep] = dependencies[dep] || devDependencies[dep];
        return o;
      }, {});

    const packageDistDir = path.join(
      workspace.distDir,
      path.relative(workspace.rootDir, target.project.rootDir),
      `${target.name}.pkg`
    );

    await fs.promises.rm(packageDistDir, { force: true, recursive: true });
    await fs.promises.mkdir(packageDistDir, { recursive: true });

    const pkgJson: Record<string, any> = {
      name: target.name,
      version: pkg.version || '1.0.0',
      private: true,
      engines: {
        node: pkg.engines && pkg.engines.node ? pkg.engines.node : `>=${process.versions.node}`,
      },
      dependencies: deps,
    };

    if (pkg.type) {
      pkgJson.type = pkg.type;
    }

    await fs.promises.writeFile(path.join(packageDistDir, 'package.json'), JSON.stringify(pkgJson, null, 2), 'utf-8');

    const yarnLock = lockfile.parse(await fs.promises.readFile(path.join(workspace.rootDir, 'yarn.lock'), 'utf-8'));

    await fs.promises.writeFile(
      path.join(packageDistDir, 'yarn.lock'),
      lockfile.stringify(pruneLockfile(yarnLock.object, deps)),
      'utf-8'
    );

    const workspaceRootToDist = path.relative(workspace.rootDir, workspace.distDir);
    await Promise.all(
      files
        .map((file) => path.relative(workspaceRootToDist, file))
        .map(async (file) => {
          await fs.promises.mkdir(path.join(packageDistDir, path.dirname(file)), { recursive: true });
          await fs.promises.symlink(path.join(workspace.distDir, file), path.join(packageDistDir, file));
        })
    );

    await copyTargetAssetsTo({ target, toDir: packageDistDir, workspace });

    try {
      await fs.promises.stat(path.join(workspace.rootDir, '.node-version'));
      await fs.promises.copyFile(
        path.join(workspace.rootDir, '.node-version'),
        path.join(packageDistDir, '.node-version')
      );
    } catch (err) {
      await fs.promises.writeFile(path.join(packageDistDir, '.node-version'), process.versions.node, 'utf-8');
    }

    const mainFile = path.join(
      path.relative(workspace.rootDir, target.project.rootDir),
      `${target.entry.slice(0, -path.extname(target.entry).length)}.js`
    );
    await fs.promises.writeFile(
      path.join(packageDistDir, 'index.js'),
      pkg.type === 'module' ? `import './${mainFile}';` : `require('./${mainFile}');`,
      'utf-8'
    );

    return packageDistDir;
  },
};
