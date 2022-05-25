import fs from 'node:fs';
import os from 'node:os';
import chalk from 'chalk';
import escalade from 'escalade/sync';
import { fileURLToPath } from 'node:url';

import type { WorkspaceConfig } from '@aella/core';

const PKG = JSON.parse(
  fs.readFileSync(
    escalade(fileURLToPath(import.meta.url), (_dir, files) => files.includes('package.json') && 'package.json')!,
    'utf-8'
  )
);

function padEnd(value: string, length: number): string {
  return value + ' '.repeat(Math.max(0, length - value.length));
}

export async function execute(workspace: Pick<WorkspaceConfig, 'commands'>, argv: string[]) {
  const commands = workspace.commands.map((command) => {
    const switches = [...command.aliases, command.name];

    return {
      command,
      text: ['  aella', switches.join(','), ...command.args].filter(Boolean).join(' '),
    };
  });

  const padToLength = Math.max(...commands.map((c) => c.text.length)) + 2;

  for (const command of commands) {
    command.text = padEnd(command.text, padToLength) + command.command.description || '';
  }

  console.error(
    [
      '',
      chalk.bold('VERSION'),
      `  aella/${PKG.version}`,
      '',
      chalk.bold('USAGE'),
      '  aella COMMAND ...',
      '  la COMMAND ...',
      '',
      chalk.bold('COMMANDS'),
      ...commands.map(({ text }) => text),
      '',
    ].join(os.EOL)
  );

  return 1;
}
