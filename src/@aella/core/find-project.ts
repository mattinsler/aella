import fs from 'node:fs';
import memo from 'memoizee';
import path from 'node:path';
import escalade from 'escalade';
import escaladeSync from 'escalade/sync';

import type { WorkspaceConfig } from './types';

import { glob } from './glob.js';
import { WORKSPACE_FILENAME } from './find-workspace.js';

const memoFindProjectConfigPath = memo(function memoFindProjectConfigPath(
  fileOrDirPath: string,
  projectConfigFilename: string
) {
  if (path.basename(fileOrDirPath) === projectConfigFilename && fs.existsSync(fileOrDirPath)) {
    return fileOrDirPath;
  }

  fileOrDirPath = path.join(fileOrDirPath, projectConfigFilename);

  if (fs.existsSync(fileOrDirPath)) {
    return fileOrDirPath;
  }

  throw new Error(`Could not find a project config file at ${fileOrDirPath}.`);
});

export function findProjectConfigPath(workspace: WorkspaceConfig, fileOrDirPath: string) {
  return memoFindProjectConfigPath(path.resolve(fileOrDirPath), workspace.project.config.filename);
}

export async function findProjectNameFromFilePath(workspace: WorkspaceConfig, filePath: string) {
  const projectConfigFilePath = await escalade(filePath, (_dir, filenames) => {
    if (filenames.includes(workspace.project.config.filename)) {
      return workspace.project.config.filename;
    }
  });

  return projectConfigFilePath ? path.relative(workspace.rootDir, path.dirname(projectConfigFilePath)) : null;
}

export function findProjectNameFromFilePathSync(workspace: WorkspaceConfig, filePath: string) {
  const projectConfigFilePath = escaladeSync(filePath, (_dir, filenames) => {
    if (filenames.includes(workspace.project.config.filename)) {
      return workspace.project.config.filename;
    }
  });

  return projectConfigFilePath ? path.relative(workspace.rootDir, path.dirname(projectConfigFilePath)) : null;
}

export function findAllProjectConfigFiles(workspace: WorkspaceConfig): Promise<string[]> {
  const config = {
    exclude: {
      directories: ['.git', 'node_modules', '__generated__'],
    },
    include: {
      files: [workspace.project.config.filename],
    },
  };

  const relativeDist = path.relative(workspace.rootDir, workspace.distDir);
  if (!relativeDist.startsWith('..')) {
    config.exclude.directories.push('/' + relativeDist);
  }

  const globber = glob(workspace.rootDir, config);
  globber.exclude((_dirName, dirPath) => fs.existsSync(path.join(dirPath, WORKSPACE_FILENAME)));

  return globber.async();
}
