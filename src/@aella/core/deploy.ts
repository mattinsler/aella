import { build } from './build.js';

import type { ProjectConfig, TargetConfig } from './types';

export function deployerForProject(project: ProjectConfig) {
  const { deployers } = project.workspace;

  if (deployers.length === 0) {
    throw new Error('No deployers are registered.');
  }

  if (project.deploy) {
    const deployer = deployers.find((b) => b.name === project.deploy);
    if (deployer) {
      return deployer;
    }
  } else if (deployers.length === 1) {
    // could we figure out an appropriate builder for the project type?
    return deployers[0];
  }

  throw new Error(`Project ${project.name} does not have a deployer configured.`);
}

export async function deploy({ project, target }: { project: ProjectConfig; target?: TargetConfig | null }) {
  const deployer = deployerForProject(project);

  await build(project, { deps: true });

  // const projects = opts.deps ? transitiveProjectsFrom(project) : [project];
  // const builders = projects.map(builderForProject);
  // const files = await pMap(projects, filesFromProject);

  // let buildOutput: {
  //   inputs: string[];
  //   outputs: string[];
  // };
  // await pMap(builders, async (builder, x) => {
  //   const buildRes = await builder.build({ files: files[x], project: projects[x] });
  //   const copyRes = await copyAssets({ files: files[x], project: projects[x] });
  //   if (project === projects[x]) {
  //     buildOutput = {
  //       inputs: [...buildRes.inputs, ...copyRes.inputs],
  //       outputs: [...buildRes.outputs, ...copyRes.outputs],
  //     };
  //   }
  // });

  // return buildOutput!;
}
