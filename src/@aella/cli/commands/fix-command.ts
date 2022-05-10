import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'jsonc-parser';
import {
  builderForProject,
  filesFromProject,
  findAllProjectConfigFiles,
  findProjectNameFromFilePathSync,
  loadProject,
  utils,
  ProjectConfig,
} from '@aella/core';

import type { Builder, Command, WorkspaceConfig } from '@aella/core';

// x root tsconfig.json has all projects referenced
// x tsconfig.base.json has paths to projects (maybe?)
// x tsconfig.json exists for projects and properly references root tsconfig.base.json
// x tsconfig.json for each project has references to dependencies
// x project.json for each project has deps properly filled in
// consistently format json config files with jsonc <== future

async function loadProjects(
  workspace: WorkspaceConfig
): Promise<Record<string, { builder: Builder; project: ProjectConfig }>> {
  const configFiles = await findAllProjectConfigFiles(workspace);
  const projects: Record<string, { builder: Builder; project: ProjectConfig }> = {};
  configFiles.forEach((file) => {
    const project = loadProject(workspace, file);
    const builder = builderForProject(project);
    projects[project.name] = { builder, project };
  });
  return projects;
}

async function readJsonFile(file: string) {
  return parse(await fs.promises.readFile(file, 'utf-8'));
}

async function analyzeDependencies(
  projects: Record<string, { builder: Builder; project: ProjectConfig }>
): Promise<Record<string, ProjectConfig['dependencies']>> {
  const depsByProject: Record<string, ProjectConfig['dependencies']> = {};

  await Promise.all(
    Object.values(projects).map(async ({ builder, project }) => {
      if (builder.extractDependencies) {
        const files = await filesFromProject(project);
        const deps = (await builder.extractDependencies({ files, project }))
          .map((dep) => {
            if (dep.value.startsWith('/')) {
              const projectName = findProjectNameFromFilePathSync(project.workspace, dep.value);
              if (projectName != null) {
                return {
                  ...dep,
                  value: `//${projectName}`,
                };
              }
            }
            return dep;
          })
          .filter((dep) => dep.value !== `//${project.name}`);

        depsByProject[project.name] = {
          build: Array.from(new Set(deps.filter((dep) => dep.build).map((dep) => dep.value))),
          lint: Array.from(new Set(deps.filter((dep) => dep.lint).map((dep) => dep.value))),
        };
      }
    })
  );

  return depsByProject;
}

async function updateRootTsconfig(workspace: WorkspaceConfig, projects: ProjectConfig[]) {
  const tsconfigFile = path.join(workspace.rootDir, 'tsconfig.json');
  const tsconfig = await readJsonFile(tsconfigFile);

  const references: { path: string }[] = tsconfig.references || [];
  projects.forEach((project) => {
    const projectTsconfigFile = path.join(project.name, 'tsconfig.json');
    if (!references.some((ref) => ref.path === projectTsconfigFile)) {
      references.push({ path: projectTsconfigFile });
    }
  });

  await utils.writeFile(tsconfigFile, JSON.stringify(tsconfig, null, 2), 'utf-8');
}

async function updateTsConfigBase(workspace: WorkspaceConfig, projects: ProjectConfig[]) {
  const tsconfigFile = path.join(workspace.rootDir, 'tsconfig.base.json');
  const tsconfigBase = await readJsonFile(tsconfigFile);
  const baseUrl = path.resolve(workspace.rootDir, tsconfigBase.compilerOptions?.baseUrl || '.');

  if (!tsconfigBase.compilerOptions) {
    tsconfigBase.compilerOptions = {};
  }
  tsconfigBase.compilerOptions.baseUrl = path.relative(workspace.rootDir, baseUrl) || '.';
  tsconfigBase.compilerOptions.paths = {};
  projects.forEach((project) => {
    tsconfigBase.compilerOptions.paths[`//${project.name}`] = [path.relative(baseUrl, project.rootDir)];
  });

  await utils.writeFile(tsconfigFile, JSON.stringify(tsconfigBase, null, 2), 'utf-8');
}

async function updateTsConfig(project: ProjectConfig, deps: ProjectConfig['dependencies']) {
  const tsconfigFile = path.join(project.rootDir, 'tsconfig.json');
  let tsconfig: any = {};
  try {
    tsconfig = JSON.parse(await fs.promises.readFile(tsconfigFile, 'utf-8'));
  } catch {}

  tsconfig.extends = path.relative(project.rootDir, path.join(project.workspace.rootDir, 'tsconfig.base.json'));

  tsconfig.references = deps.lint
    .filter((dep) => dep.startsWith('//'))
    .map((dep) => ({
      path: path.relative(project.rootDir, path.join(project.workspace.rootDir, dep.slice(2))),
    }));

  await utils.writeFile(tsconfigFile, JSON.stringify(tsconfig, null, 2), 'utf-8');
}

async function updateProjectConfig(project: ProjectConfig, deps: ProjectConfig['dependencies']) {
  const config = JSON.parse(await fs.promises.readFile(project.configFile, 'utf-8'));

  const build = deps.build.filter((dep) => !dep.startsWith('.')).sort();
  const lint = deps.lint.filter((dep) => !dep.startsWith('.')).sort();

  if (build.length === 0 && lint.length === 0) {
    delete config.dependencies;
  } else {
    config.dependencies = { build, lint };
  }

  await utils.writeFile(project.configFile, JSON.stringify(config, null, 2), 'utf-8');
}

async function execute(workspace: WorkspaceConfig, argv: string[]) {
  const projects = await loadProjects(workspace);
  const depsByProject = await analyzeDependencies(projects);

  await Promise.all([
    updateRootTsconfig(
      workspace,
      Object.values(projects).map(({ project }) => project)
    ),
    updateTsConfigBase(
      workspace,
      Object.values(projects).map(({ project }) => project)
    ),
    ...Object.values(projects).map(({ project }) => updateTsConfig(project, depsByProject[project.name])),
    ...Object.values(projects).map(({ project }) => updateProjectConfig(project, depsByProject[project.name])),
  ]);

  return 0;
}

export const fix: Command = {
  aliases: [],
  args: [],
  execute,
  name: 'fix',
  description: 'Analyze code and fix config files',
};
