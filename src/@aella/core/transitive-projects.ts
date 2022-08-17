import { loadProject } from './load-project.js';

import type { ProjectConfig } from './types';

function internalTransitiveProjects(project: ProjectConfig, transitiveType: 'build' | 'lint'): Set<ProjectConfig> {
  const { workspace } = project;
  const projectsMap = new Map<string, ProjectConfig>();
  const queue = [project];

  while (queue.length) {
    const current = queue.shift()!;
    projectsMap.set(current.name, current);
    current.dependencies[transitiveType].forEach((depName) => {
      if (depName.startsWith('//') && !projectsMap.has(depName.slice(2))) {
        const dep = loadProject(workspace, depName.slice(2));
        if (dep) {
          queue.push(dep);
        }
      }
    });
  }

  return new Set(projectsMap.values());
}

export function transitiveProjects(project: ProjectConfig, transitiveType: 'build' | 'lint') {
  return Array.from(internalTransitiveProjects(project, transitiveType));
}

export function transitiveDepProjects(project: ProjectConfig, transitiveType: 'build' | 'lint') {
  const projects = internalTransitiveProjects(project, transitiveType);
  projects.delete(project);
  return Array.from(projects);
}
