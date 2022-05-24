import { loadProject } from './load-project.js';

import type { ProjectConfig } from './types';

export function transitiveProjects(projects: ProjectConfig[], transitiveType: 'build' | 'lint') {
  if (projects.length === 0) {
    return [];
  }

  const { workspace } = projects[0];
  const projectsMap = new Map<string, ProjectConfig>();
  const queue = [...projects];

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

  return Array.from(projectsMap.values());
}
