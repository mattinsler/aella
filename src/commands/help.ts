import os from 'os';
import chalk from 'chalk';

export function help(errorMessage?: string) {
  const lines = [
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
