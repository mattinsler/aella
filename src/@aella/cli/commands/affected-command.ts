import { findAllProjectConfigFiles, findProjectNameFromFilePath, loadProject } from '@aella/core';

import type { ProjectConfig, WorkspaceConfig } from '@aella/core';

function buildInverseDependencyMap(projectsByName: Record<string, ProjectConfig>): Record<string, ProjectConfig[]> {
  const map: Record<string, ProjectConfig[]> = {};

  for (const project of Object.values(projectsByName)) {
    for (const dep of project.dependencies.lint) {
      if (dep.startsWith('//')) {
        const depName = dep.slice(2);
        if (projectsByName[depName]) {
          if (!map[depName]) {
            map[depName] = [];
          }
          map[depName].push(project);
        }
      }
    }
  }

  return map;
}

async function buildProjectsByName(workspace: WorkspaceConfig): Promise<Record<string, ProjectConfig>> {
  const configFiles = await findAllProjectConfigFiles(workspace);
  return configFiles
    .map((configFile) => loadProject(workspace, configFile))
    .reduce<Record<string, ProjectConfig>>((agg, project) => {
      agg[project.name] = project;
      return agg;
    }, {});
}

function transitiveProjectNamesByDepsFrom(
  projectNames: string[],
  projectsByDep: Record<string, ProjectConfig[]>
): string[] {
  const queue = [...projectNames];
  const transitiveProjectNames = new Set<string>();

  while (queue.length) {
    const projectName = queue.shift()!;
    if (!transitiveProjectNames.has(projectName)) {
      transitiveProjectNames.add(projectName);
      queue.push(...(projectsByDep[projectName] || []).map((project) => project.name));
    }
  }

  return Array.from(transitiveProjectNames);
}

export async function execute(workspace: WorkspaceConfig, argv: string[]) {
  const projectNames = Array.from(
    new Set(
      (await Promise.all(argv.map((file) => findProjectNameFromFilePath(workspace, file)))).filter(Boolean) as string[]
    )
  );

  if (projectNames.length === 0) {
    return 0;
  }

  const projectsByName = await buildProjectsByName(workspace);
  const projectsByDep = buildInverseDependencyMap(projectsByName);
  const affectedProjectNames = transitiveProjectNamesByDepsFrom(projectNames, projectsByDep);
  affectedProjectNames.sort();
  console.log(affectedProjectNames);

  return 0;
}
