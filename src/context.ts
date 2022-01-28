import path from 'path';
import memo from 'memoizee';

import type { ProjectConfig, TargetConfig, WorkspaceConfig } from './types.js';

import { readProjectConfig } from './config/project-config.js';
import { createFdirProjectResolver } from './fdir-project-resolver.js';
import { findWorkspaceDir, readWorkspaceConfigSync } from './config/workspace-config.js';

export interface Context {
  readonly workspace: WorkspaceConfig;

  getProject(name: string): Promise<ProjectConfig | null>;
  getProjectMap(): Promise<Map<string, ProjectConfig>>;
  getProjects(): Promise<ProjectConfig[]>;
  getTargets(): Promise<TargetConfig[]>;
}

const loadContextImpl = memo(
  async function loadContextImpl(workspaceDir: string): Promise<Context> {
    const workspace = readWorkspaceConfigSync(workspaceDir);
    if (!workspace) {
      throw new Error(`Cannot find a workspace.json at or above ${workspaceDir}.`);
    }
    const projectResolver = createFdirProjectResolver(workspace);

    const getProjectByFilename = memo(
      function getProjectByFilename(filename: string) {
        return readProjectConfig(filename, workspace.rootDir);
      },
      { promise: true }
    );

    const getProjects = memo(
      async function getProject() {
        const files = await projectResolver.resolveAll();
        const projects = await Promise.all(files.map(async (file) => (await getProjectByFilename(file))!));
        projects.sort((l, r) => l.name.localeCompare(r.name));
        return projects;
      },
      { promise: true }
    );

    const getProjectMap = memo(
      async function getProjectMap() {
        const projects = await getProjects();
        return new Map(projects.map((p) => [p.name, p]));
      },
      { promise: true }
    );

    const getTargets = memo(
      async function getTargets() {
        const projects = await getProjects();
        const targets = projects.flatMap(({ targets }) =>
          Array.from(targets.values()).sort((l, r) => l.name.localeCompare(r.name))
        );
        return targets;
      },
      { promise: true }
    );

    return {
      workspace,

      getProject(name: string) {
        if (path.isAbsolute(name) && path.basename(name) === workspace.project.config.filename) {
          return getProjectByFilename(name);
        }
        return getProjectByFilename(path.join(workspace.rootDir, name, workspace.project.config.filename));
      },
      getProjectMap,
      getProjects,
      getTargets,
    };
  },
  {
    promise: true,
  }
);

export function loadContext(forPath: string = process.cwd()) {
  const workspaceDir = findWorkspaceDir(forPath);
  return loadContextImpl(workspaceDir);
}
