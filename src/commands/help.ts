import fs from 'fs';
import os from 'os';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const pkg = JSON.parse(
  fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json'), 'utf-8')
);

export function help(errorMessage?: string) {
  const lines = [
    '',
    chalk.bold('VERSION'),
    `  ${pkg.name}/${pkg.version}`,
    '',
    chalk.bold('USAGE'),
    '  aella COMMAND ...',
    '  la COMMAND ...',
    '',
    '  aella -l,--ls,--list              List available commands',
    // '  aella -e,--exec FILE           Execute a specific source file',
    '  aella -b,--build PROJECT          Build a project',
    '  aella -p,--pkg,--package PROJECT  Package a project',
    '  aella -h,--help                   Print help information',
    '',
  ];

  if (errorMessage) {
    lines.unshift(chalk.bold.red('[ERROR] ') + errorMessage, '');
  }

  console.error(lines.join(os.EOL));

  process.exitCode = 1;
}
