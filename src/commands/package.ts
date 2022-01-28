import { resolve } from '../resolve.js';
import { loadContext } from '../context.js';
// import { npmPackager } from '../packagers/npm-packager.js';
import { dockerPackager } from '../packagers/docker-packager.js';

export async function packageCommand(argv: string[]) {
  const context = await loadContext();
  const { target } = await resolve(context, argv);

  if (!target) {
    throw new Error('No target to package');
  }

  await dockerPackager.package({ target, workspace: context.workspace });
}
