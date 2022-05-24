import 'source-map-support/register.js';
import 'v8-compile-cache';

import chalk from 'chalk';
import {
  createEmptyWorkspaceConfig,
  findWorkspaceRoot,
  loadWorkspace as coreLoadWorkspace,
  resolveTarget,
} from '@aella/core';

import type { WorkspaceConfig } from '@aella/core';

import { affected, build, deploy, fix, help, init, list, run, test } from './commands/index.js';

const DEFAULT_COMMANDS = [run, affected, build, test, deploy, fix, init, list, help];

function findCommand(workspace: WorkspaceConfig, value: string) {
  return workspace.commands.find((command) => {
    return new Set([...command.aliases, command.name]).has(value);
  });
}

function errorText(err: any) {
  if (err instanceof Error) {
    return err.message;
  } else if (typeof err === 'string') {
    return err;
  }
  return String(err);
}

async function loadWorkspace(rootDir: string, command: string) {
  try {
    await findWorkspaceRoot(rootDir);
  } catch (err) {
    if (command === 'init' || command === 'help' || command === undefined) {
      console.error(`${chalk.red.bold('[ERROR]')} ${errorText(err)}`);
      return createEmptyWorkspaceConfig(rootDir);
    }
    throw err;
  }

  return coreLoadWorkspace(process.cwd());
}

export async function main(argv: string[]) {
  try {
    const workspace = await loadWorkspace(process.cwd(), argv[0]);

    workspace.commands.push(...DEFAULT_COMMANDS);

    let command;
    if (argv.length === 0) {
      command = help;
    } else {
      command = findCommand(workspace, argv[0]);
      if (command == null) {
        const { file, project, target } = resolveTarget(workspace, argv[0]);
        if (project && (file || target)) {
          command = run.createCommand({ file, project, target });
        }
      }
    }

    if (command == null) {
      console.error(`${chalk.red.bold('[ERROR]')} Invalid command: ${argv[0]}.`);
      command = help;
    }

    process.exitCode = await command.execute(workspace, argv.slice(1));
  } catch (err) {
    console.error(`${chalk.red.bold('[ERROR]')} ${errorText(err)}`);
    if (process.env.DEBUG && err instanceof Error) {
      console.error(err);
    }
    process.exitCode = 1;
  } finally {
    process.exit();
  }
}
