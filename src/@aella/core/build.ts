import pMap from 'p-map';
import path from 'node:path';

import { copyAssets } from './copy-assets.js';
import { filesFromProject } from './files-from-project.js';
import { transitiveProjects } from './transitive-projects.js';

import type { BuildProjectResult, BuildTargetResult, ProjectConfig, TargetConfig } from './types';

export function builderForProject(project: ProjectConfig) {
  const { builders } = project.workspace;

  if (builders.length === 0) {
    throw new Error('No builders are registered.');
  }

  if (project.build) {
    const builder = builders.find((b) => b.name === project.build?.type);
    if (builder) {
      return builder;
    }
  } else if (builders.length === 1) {
    // could we figure out an appropriate builder for the project type?
    return builders[0];
  }

  throw new Error(`Project ${project.name} does not have a builder configured.`);
}

export function build(opts: { deps?: boolean; project: ProjectConfig }): Promise<BuildProjectResult>;
export function build(opts: { target: TargetConfig }): Promise<BuildProjectResult & BuildTargetResult>;
export function build(opts: { deps?: boolean; projects: ProjectConfig[] }): Promise<Array<BuildProjectResult>>;
export function build(opts: { targets: TargetConfig[] }): Promise<Array<BuildProjectResult & BuildTargetResult>>;
export async function build(opts: {
  deps?: boolean;
  project?: ProjectConfig;
  projects?: ProjectConfig[];
  target?: TargetConfig;
  targets?: TargetConfig[];
}) {
  const deps = opts.target || opts.targets ? true : opts.deps || false;
  const originalProjects = opts.target
    ? [opts.target.project]
    : opts.targets
    ? opts.targets.map((t) => t.project)
    : opts.project
    ? [opts.project]
    : opts.projects
    ? opts.projects
    : undefined;
  if (!originalProjects) {
    throw new Error('No projects to build.');
  }

  const projectsToBuildMap = new Map(
    originalProjects.map((project) => [project, deps ? transitiveProjects([project], 'build') : [project]])
  );

  const allProjectsToBuild = Array.from(new Set(Array.from(projectsToBuildMap.values()).flat()));

  const allFiles = await pMap(allProjectsToBuild, filesFromProject);
  const projectsMap = new Map(
    allProjectsToBuild.map((project, x) => [
      project,
      {
        builder: builderForProject(project),
        files: allFiles[x],
        project,
        depProjects: projectsToBuildMap.get(project)!,
      },
    ])
  );

  const outputsMap = new Map(
    await pMap(projectsMap.values(), async ({ builder, files, project, depProjects }) => {
      const buildRes = await builder.buildProject({ files, project });
      const copyRes = await copyAssets({ files, project });

      return [
        project,
        {
          inputs: [
            ...buildRes.inputs.map((i) => path.join(project.name, i)),
            ...copyRes.inputs.map((i) => path.join(project.name, i)),
          ],
          outputs: [
            ...buildRes.outputs.map((i) => path.join(project.name, i)),
            ...copyRes.outputs.map((i) => path.join(project.name, i)),
          ],
        },
      ];
    })
  );

  function outputsFromProject(project: ProjectConfig): BuildProjectResult & { project: ProjectConfig } {
    const projects = [project, ...projectsMap.get(project)!.depProjects];
    const buildOutputs = Array.from(new Set(projects)).map((project) => outputsMap.get(project)!);

    return {
      inputs: buildOutputs.flatMap((o) => o.inputs),
      outputs: buildOutputs.flatMap((o) => o.outputs),
      project,
    };
  }

  if (opts.project) {
    return outputsFromProject(opts.project);
  }
  if (opts.projects) {
    return opts.projects.map(outputsFromProject);
  }

  if (opts.target) {
    const buildOutput = outputsFromProject(opts.target.project);
    const targetOutput = await projectsMap.get(opts.target.project)!.builder.buildTarget({
      files: buildOutput,
      projects: projectsToBuildMap.get(opts.target.project)!,
      target: opts.target,
    });
    return {
      ...buildOutput,
      ...targetOutput,
    };
  }
  if (opts.targets) {
    return pMap(opts.targets, async (target) => {
      const buildOutput = outputsFromProject(target.project);
      const targetOutput = await projectsMap.get(target.project)!.builder.buildTarget({
        files: buildOutput,
        projects: projectsToBuildMap.get(target.project)!,
        target,
      });
      return {
        ...buildOutput,
        ...targetOutput,
      };
    });
  }
}
