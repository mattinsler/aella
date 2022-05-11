import fs from 'node:fs';
import path from 'node:path';

import { loadProject } from './load-project.js';
import { findProjectNameFromFilePathSync } from './find-project.js';

import type { ProjectConfig, TargetConfig, WorkspaceConfig } from './types';

function parse(value: string) {
  const idx = value.indexOf(':');
  return idx === -1
    ? {
        project: value,
        target: path.basename(value),
      }
    : {
        project: value.slice(0, idx),
        target: value.slice(idx + 1),
      };
}

export function resolveTarget(
  workspace: WorkspaceConfig,
  value: string
): {
  file: null | string;
  project: null | ProjectConfig;
  target: null | TargetConfig;
} {
  const stat = fs.statSync(value, { throwIfNoEntry: false });
  if (stat && stat.isFile()) {
    const projectName = findProjectNameFromFilePathSync(workspace, value);
    if (projectName) {
      const project = loadProject(workspace, projectName);
      return {
        file: path.relative(project.rootDir, path.resolve(value)),
        project,
        target: null,
      };
    }
  }

  const parsed = parse(value.replace(/\/+$/, ''));
  const project = loadProject(workspace, parsed.project);

  if (!project) {
    return { file: null, project: null, target: null };
  }

  return {
    file: null,
    project,
    target: project.targets.get(parsed.target) || null,
  };
}