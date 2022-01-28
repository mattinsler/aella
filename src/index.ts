import { build, exec, help, list, run, packageCommand } from './commands/index.js';

export async function main(argv: string[]) {
  if (argv.length === 0 || ~['--help', '-h'].indexOf(argv[0])) {
    help();
  } else if (~['--ls', '--list', '-l'].indexOf(argv[0])) {
    await list();
  } else if (~['--exec', '-e'].indexOf(argv[0])) {
    exec(argv.slice(1));
  } else if (~['--build', '-b'].indexOf(argv[0])) {
    build(argv.slice(1));
  } else if (~['--package', '--pkg', '-p'].indexOf(argv[0])) {
    packageCommand(argv.slice(1));
  } else if (argv[0][0] === '-') {
    help(`Invalid command: ${argv[0]}.`);
  } else {
    run(argv);
  }
}
