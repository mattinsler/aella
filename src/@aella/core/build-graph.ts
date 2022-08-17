import type { Edge, Graph, Node } from './graph';
import type { Directory, File, Provider } from './types';

import { Label } from './label.js';
import { createGraph } from './graph.js';
import { loadProject } from './load-project.js';
import { filesFromProject } from './files-from-project.js';

import type { ProjectConfig, TargetConfig, WorkspaceConfig } from './types';

export type BuildGraph = Graph<BuildStep, Label>;
export type BuildGraphNode = Node<BuildStep, Label>;
export type BuildGraphEdge = Edge<BuildStep, Label>;

export interface BuildStepContext {
  readonly label: Label;
  readonly workspace: WorkspaceConfig;

  directory(path: string, root: string): Directory;
  file(path: string, root: string): File;
  file(path: string, root: Directory): File;
  file(file: File, root: string): File;
  file(file: File, root: Directory): File;
  file(file: Directory, root: string): Directory;

  action<TConfig>(
    fn: (config: TConfig) => Promise<void>,
    opts: { config: TConfig; inputs: File[]; outputs: File[] },
    mnemonic: string
  ): void;
}

export interface BuildStep {
  execute: (context: BuildStepContext, data: Provider[]) => Promise<Provider[]>;
  label: Label;
  mnemonic: string;
}

interface Loader {
  loadProject(label: Label): ProjectConfig;
  loadTarget(label: Label): TargetConfig;
}

function createLoader(workspace: WorkspaceConfig): Loader {
  const projects = new Map<string, ProjectConfig>();
  const targets = new Map<string, TargetConfig>();

  function _loadProject(label: Label) {
    let project = projects.get(label.project);
    if (!project) {
      project = loadProject(workspace, label.project);
      projects.set(label.project, project);
    }
    return project;
  }
  function _loadTarget(label: Label) {
    if (!label.target) {
      throw new Error();
    }
    const key = Label.toString(label);
    let target = targets.get(key);
    if (!target) {
      const project = _loadProject(label);
      target = project.targets.get(label.target!);
      if (!target) {
        throw new Error();
      }
      targets.set(key, target);
    }
    return target;
  }

  return {
    loadProject: _loadProject,
    loadTarget: _loadTarget,
  };
}

function addLabelsToGraph(loader: Loader, graph: Graph<BuildStep, Label>, initialLabels: Label[]) {
  const stack = [...initialLabels];
  const seenLabels = new Set<Label>();

  while (stack.length) {
    const label = stack.pop()!;

    if (seenLabels.has(label)) {
      continue;
    }

    seenLabels.add(label);

    if (label.target) {
      // label is a target
      const target = loader.loadTarget(label);

      graph.add(label, {
        execute: executeTarget(target),
        label,
        mnemonic: `Target ${Label.toString(label)}`,
      });

      const projectLabel = Label.from(target.project);

      if (target.bundle.target) {
        const depTargetLabel = Label.from(target.bundle.target, projectLabel);
        graph.addEdge(label, depTargetLabel);
        stack.push(depTargetLabel);
      } else {
        graph.addEdge(label, projectLabel);
        stack.push(projectLabel);
      }
    } else {
      // label is a project
      const project = loader.loadProject(label);

      graph.add(label, {
        execute: executeProject(project),
        label,
        mnemonic: `Project ${Label.toString(label)}`,
      });

      const projectDepLabels = Array.from(new Set([...project.dependencies.build, ...project.dependencies.lint]))
        .filter(Label.isLabel)
        .map((dep) => Label.from(dep));

      projectDepLabels.forEach((depLabel) => {
        graph.addEdge(label, depLabel);
      });
      stack.push(...projectDepLabels);
    }
  }
}

import fs from 'node:fs';
import path from 'node:path';
import { DefaultInfo } from './default-info.js';

interface CopyFilesConfig {
  copies: { from: File; to: File }[];
}
async function copyFiles({ copies }: CopyFilesConfig) {
  const dirs = new Set(copies.map(({ to }) => to.absoluteDirectory));
  await Promise.all(Array.from(dirs).map((dir) => fs.promises.mkdir(dir, { recursive: true })));
  await Promise.all(copies.map(({ from, to }) => fs.promises.copyFile(from.absolutePath, to.absolutePath)));
}

function copyAssets(context: BuildStepContext, assets: File[]) {
  const inputs = assets;
  const outputs = inputs.map((file) => context.file(file, context.workspace.distDir));

  context.action(
    copyFiles,
    {
      config: {
        copies: inputs.map((from, idx) => ({ from, to: outputs[idx] })),
      },
      inputs,
      outputs,
    },
    'Copy Assets'
  );

  return DefaultInfo({ files: outputs });
}

function executeProject(project: ProjectConfig) {
  return async (context: BuildStepContext, data: Provider[]) => {
    const providers: Provider[] = [...data];

    const files = await filesFromProject(project);
    const assets = files.assets.map((filename) =>
      context.file(path.join(project.name, filename), context.workspace.rootDir)
    );
    const sources = files.sources.map((filename) =>
      context.file(path.join(project.name, filename), context.workspace.rootDir)
    );

    if (assets.length) {
      providers.push(copyAssets(context, assets));
    }

    if (sources.length) {
      const builder = context.workspace.getBuilder(project, true);
      providers.push(
        ...builder.build(context, {
          config: project.build.config,
          sources,
          project,
        })
      );
    }

    return providers;
  };
}

function executeTarget(target: TargetConfig) {
  return async (context: BuildStepContext, data: Provider[]) => {
    const providers: Provider[] = [];

    const bundler = context.workspace.getBundler(target, true);
    providers.push(
      ...bundler.bundle(context, {
        config: target.bundle.config,
        data,
        target,
      })
    );

    return providers;
  };
}

export function assembleBuildGraph(workspace: WorkspaceConfig, destinations: Label[]): BuildGraph {
  const graph = createGraph<BuildStep, Label>();
  const loader = createLoader(workspace);

  addLabelsToGraph(loader, graph, destinations);

  return graph;
}
