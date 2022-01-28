import { resolve } from '../resolve.js';
import { loadContext } from '../context.js';
import { typescriptBuilder } from '../builders/typescript-builder/index.js';

export async function build(argv: string[]) {
  const context = await loadContext();
  const { project, target } = await resolve(context, argv);

  if (!project) {
    throw new Error('Nothing to build');
  }

  await typescriptBuilder.build({ project, target, workspace: context.workspace });
}
