import pMap from 'p-map';
import path from 'node:path';

import { copyAssets } from './copy-assets.js';
import { filesFromProject } from './files-from-project.js';
import { transitiveProjects } from './transitive-projects.js';

import type { ProjectConfig } from './types';

export function builderForProject(project: ProjectConfig) {
  const { builders } = project.workspace;

  if (builders.length === 0) {
    throw new Error('No builders are registered.');
  }

  if (project.build) {
    const builder = builders.find((b) => b.name === project.build);
    if (builder) {
      return builder;
    }
  } else if (builders.length === 1) {
    // could we figure out an appropriate builder for the project type?
    return builders[0];
  }

  throw new Error(`Project ${project.name} does not have a builder configured.`);
}

export async function build(project: ProjectConfig, opts: { deps?: boolean } = {}) {
  // find builder
  // get source files
  // calculate sha
  // build

  const projects = opts.deps ? transitiveProjects(project, 'build') : [project];
  const builders = projects.map(builderForProject);
  const files = await pMap(projects, filesFromProject);

  const buildOutput: {
    inputs: string[];
    outputs: string[];
  } = { inputs: [], outputs: [] };
  await pMap(builders, async (builder, x) => {
    const buildRes = await builder.build({ files: files[x], project: projects[x] });
    const copyRes = await copyAssets({ files: files[x], project: projects[x] });

    // const src = path.relative(projects[x].workspace.rootDir, projects[x].rootDir);
    // const dist = path.relative(projects[x].workspace.distDir, path.join(projects[x].workspace.distDir, src));

    buildOutput.inputs.push(...buildRes.inputs.map((i) => path.join(projects[x].name, i)));
    buildOutput.inputs.push(...copyRes.inputs.map((i) => path.join(projects[x].name, i)));

    buildOutput.outputs.push(...buildRes.outputs.map((i) => path.join(projects[x].name, i)));
    buildOutput.outputs.push(...copyRes.outputs.map((i) => path.join(projects[x].name, i)));
  });

  return buildOutput!;
}
