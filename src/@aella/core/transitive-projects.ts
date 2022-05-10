import { loadProject } from './load-project.js';

import type { ProjectConfig } from './types';

export function transitiveProjects(project: ProjectConfig, transitiveType: 'build' | 'lint') {
  const { workspace } = project;
  const projects = new Map<string, ProjectConfig>();
  const queue = [project];

  while (queue.length) {
    const current = queue.shift()!;
    projects.set(current.name, current);
    current.dependencies[transitiveType].forEach((depName) => {
      if (depName.startsWith('//') && !projects.has(depName.slice(2))) {
        const dep = loadProject(workspace, depName.slice(2));
        if (dep) {
          queue.push(dep);
        }
      }
    });
  }

  return Array.from(projects.values());
}
