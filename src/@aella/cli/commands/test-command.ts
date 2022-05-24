import fs from 'node:fs';
import path from 'node:path';
import { runCLI } from '@jest/core';
import { build, findAllProjectConfigFiles, loadProject } from '@aella/core';

import type { Command, TargetConfig, WorkspaceConfig } from '@aella/core';

async function resolveProjects(workspace: WorkspaceConfig, argv: string[]) {
  let projects;
  if (argv.length === 0) {
    const configFiles = await findAllProjectConfigFiles(workspace);
    projects = configFiles.map((configFile) => loadProject(workspace, configFile));
  } else {
    const configFiles = await Promise.all(argv.map((arg) => findAllProjectConfigFiles(workspace, arg)));
    projects = Array.from(new Set(configFiles.flat())).map((configFile) => loadProject(workspace, configFile));
  }
  return projects.filter((project) => project.test);
}

async function execute(workspace: WorkspaceConfig, argv: string[]) {
  const projects = await resolveProjects(workspace, argv);

  if (projects.length === 0) {
    throw new Error('Nothing to test.');
  }

  const targets = projects.map<TargetConfig>((project) => ({
    assets: [],
    entry: '',
    isDefault: false,
    name: 'test',
    originalConfig: {},
    project,
  }));

  const results = await build({ targets });
  const jestConfigFiles = results.map(({ project, sandboxDir }) => {
    const configFile = path.join(sandboxDir, 'jest.config.js');
    fs.writeFileSync(
      configFile,
      'export default ' +
        JSON.stringify(
          {
            displayName: project.name,
            testEnvironment: 'jest-environment-node',
            transform: {},
          },
          null,
          2
        ),
      'utf-8'
    );

    return configFile;
  });

  // fs.writeFileSync(
  //   path.join(workspace.distDir, 'jest.config.js'),
  //   'export default ' +
  //     JSON.stringify(
  //       {
  //         projects: jestConfigFiles,
  //       },
  //       null,
  //       2
  //     ),
  //   'utf-8'
  // );

  const testFiles = results.flatMap(({ outputs, project, sandboxDir }) =>
    outputs
      .filter((file) => file.startsWith(project.name) && file.endsWith('.test.js'))
      .map((file) => path.relative(workspace.rootDir, path.join(sandboxDir, file)))
  );

  // process.env.NODE_OPTIONS = '--experimental-vm-modules';
  // console.log(
  //   {
  //     $0: 'node_modules/jest/bin/jest.js',
  //     _: [...testFiles],
  //     reporters: ['@aella/jest'],
  //     runTestsByPath: true,
  //     watchman: false,
  //   },
  //   [workspace.rootDir]
  // );
  const jestOutput = await runCLI(
    {
      $0: 'node_modules/jest/bin/jest.js',
      _: [...testFiles],
      silent: true,
      runTestsByPath: true,
      watchman: false,
    },
    [workspace.rootDir]
  );
  // );

  // await execa(path.join(workspace.rootDir, 'node_modules/jest/bin/jest.js'), ['--no-watchman'], {
  //   cwd: workspace.distDir,
  //   env: {
  //     ...process.env,
  //     NODE_OPTIONS: '--experimental-vm-modules',
  //   },
  //   stdio: 'inherit',
  // });

  // for (const { outputs, project, sandboxDir } of results) {
  //   const testFiles = outputs.filter((file) => file.startsWith(project.name) && file.endsWith('.test.js'));
  //   if (testFiles.length > 0) {
  //     fs.writeFileSync(
  //       path.join(sandboxDir, 'jest.config.js'),
  //       'export default ' +
  //         JSON.stringify(
  //           {
  //             testEnvironment: 'jest-environment-node',
  //             transform: {},
  //           },
  //           null,
  //           2
  //         ),
  //       'utf-8'
  //     );

  //     await execa('node_modules/jest/bin/jest.js', ['--no-watchman', '--runTestsByPath', ...testFiles], {
  //       cwd: sandboxDir,
  //       env: {
  //         ...process.env,
  //         NODE_OPTIONS: '--experimental-vm-modules',
  //       },
  //       stdio: 'inherit',
  //     });
  //   }
  // }

  return 0;
}

export const test: Command = {
  aliases: [],
  args: ['PROJECT'],
  execute,
  name: 'test',
  description: 'Test a project',
};
