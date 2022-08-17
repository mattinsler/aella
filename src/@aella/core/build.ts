import type { Provider } from './providers';
import type { ProjectConfig, TargetConfig } from './types';

import type { WorkspaceConfig } from './types';
import type { BuildGraph } from './build-graph';
import type { Action, ActionGraph, ActionNode } from './action-graph';

import { Label } from './label.js';
import { DefaultInfo } from './default-info.js';
import { createGraph, Graph, Node } from './graph.js';
import { createActionGraph } from './action-graph.js';
import { createDirectory, createFile } from './files.js';
import { assembleBuildGraph, BuildGraphNode } from './build-graph.js';

async function buildGraphToActionGraph(workspace: WorkspaceConfig, graph: BuildGraph) {
  return new Promise<{ actionGraph: ActionGraph; labelToProviders: Map<Label, Provider[]> }>((resolve, reject) => {
    const nodes = graph.nodes;
    const completedNodes = new Map<BuildGraphNode, Provider[]>();

    // execute build graph nodes to get action node graph
    // execute nodes that have all edgesFrom in the completedNodes list
    // at some point we'll include edge labels here

    // instantiate action graph
    const actionGraph = createActionGraph();

    const dataForNodeExecution = (node: BuildGraphNode) =>
      node.edgesFrom.map((edge) => completedNodes.get(edge.to.node));

    async function execute(node: BuildGraphNode) {
      const data = dataForNodeExecution(node);
      if (data.some((d) => d == null)) {
        return;
      }

      try {
        // console.log(`[Build Graph] Executing ${node.data.mnemonic}`);
        // const start = Date.now();
        const providers = await node.data.execute(
          {
            action: (execute, opts, mnemonic) => {
              // console.log(`[Action Graph] Registered ${mnemonic}`);

              const action: Action<any> = {
                config: opts.config,
                // @ts-expect-error
                execute,
                inputs: opts.inputs,
                label: node.data.label,
                mnemonic,
                outputs: opts.outputs,
              };

              opts.inputs.forEach((input) => {
                actionGraph.add(input.absolutePath, input.absolutePath);
                opts.outputs.forEach((output) => {
                  actionGraph.add(output.absolutePath, output.absolutePath);
                  actionGraph.addEdge(input.absolutePath, output.absolutePath, action);
                });
              });
            },
            directory: createDirectory,
            file: createFile,
            label: node.data.label,
            workspace,
          },
          data.flat() as Provider[]
        );
        // const end = Date.now();
        completedNodes.set(node, providers);
        // console.log(`[Build Graph] Executing ${node.data.mnemonic} DONE ${end - start}ms`);

        if (nodes.length === completedNodes.size) {
          return resolve({
            actionGraph,
            labelToProviders: new Map(
              Array.from(completedNodes.entries()).map(([{ key }, providers]) => [key, providers])
            ),
          });
        }

        node.edgesTo.forEach((edge) => execute(edge.from.node));
      } catch (err) {
        console.error(err);
        // do we reject here?
      }
    }

    nodes.forEach(execute);
  });
}

type ExecutionGraph = Graph<Action<any>, Action<any>>;
type ExecutionGraphNode = Node<Action<any>, Action<any>>;

function actionGraphToExecutionGraph(actionGraph: ActionGraph, files: string[]) {
  const executionGraph = createGraph<Action<any>, Action<any>>();

  const nodes: [ActionNode, Action<any> | undefined][] = (
    files.map((file) => actionGraph.get(file)).filter(Boolean) as ActionNode[]
  ).map((node) => [node, undefined]);

  while (nodes.length) {
    const [node, prevAction] = nodes.pop()!;

    node.edgesTo.forEach((edge) => {
      executionGraph.add(edge.data, edge.data);
      if (prevAction) {
        executionGraph.addEdge(prevAction, edge.data);
      }

      nodes.push([edge.from.node, edge.data]);
    });
  }

  return executionGraph;
}

function executeExecutionGraph(executionGraph: ExecutionGraph) {
  return new Promise<void>((resolve, reject) => {
    const executionGraphNodes = executionGraph.nodes;
    const completedNodes = new Set<ExecutionGraphNode>();

    async function execute(node: ExecutionGraphNode) {
      if (node.edgesFrom.some((edge) => !completedNodes.has(edge.to.node))) {
        return;
      }

      try {
        console.log(`[Execution Graph] Executing ${node.data.mnemonic}`);
        const start = Date.now();
        await node.data.execute(node.data.config);
        const end = Date.now();
        completedNodes.add(node);
        console.log(`[Execution Graph] Executing ${node.data.mnemonic} DONE ${end - start}ms`);

        if (executionGraphNodes.length === completedNodes.size) {
          return resolve();
        }

        node.edgesTo.forEach((edge) => execute(edge.from.node));
      } catch (err) {
        console.error(err);
      }
    }

    executionGraphNodes.forEach(execute);
  });
}

export function build(workspace: WorkspaceConfig, opts: { project: ProjectConfig }): Promise<Provider[]>;
export function build(workspace: WorkspaceConfig, opts: { projects: ProjectConfig[] }): Promise<Provider[][]>;
export function build(workspace: WorkspaceConfig, opts: { target: TargetConfig }): Promise<Provider[]>;
export function build(workspace: WorkspaceConfig, opts: { targets: TargetConfig[] }): Promise<Provider[][]>;
export async function build(
  workspace: WorkspaceConfig,
  opts: {
    project?: ProjectConfig;
    projects?: ProjectConfig[];
    target?: TargetConfig;
    targets?: TargetConfig[];
  }
) {
  const labels = opts.project
    ? [Label.from(opts.project)]
    : opts.projects
    ? opts.projects.map(Label.from)
    : opts.target
    ? [Label.from(opts.target)]
    : opts.targets
    ? opts.targets.map(Label.from)
    : [];

  if (labels.length === 0) {
    throw new Error('Nothing to build.');
  }

  const buildGraph = assembleBuildGraph(workspace, labels);

  const { actionGraph, labelToProviders } = await buildGraphToActionGraph(workspace, buildGraph);
  const providers = labels.flatMap((label) => labelToProviders.get(label)!);

  const files = DefaultInfo.files(providers).map((file) => file.absolutePath);
  const executionGraph = actionGraphToExecutionGraph(actionGraph, files);
  await executeExecutionGraph(executionGraph);

  // const details = {
  //   action: actionGraph.details({
  //     edgeDataToJSON: ({ label, mnemonic }) => ({ label: label.toString(), mnemonic }),
  //     keyToString: (key) => key,
  //     nodeDataToJSON: (nodeData) => ({
  //       file: nodeData,
  //     }),
  //   }),
  //   build: buildGraph.details({
  //     edgeDataToJSON: () => ({}),
  //     keyToString: (key) => key.toString(),
  //     nodeDataToJSON: ({ mnemonic }) => ({
  //       mnemonic,
  //     }),
  //   }),
  //   execution: executionGraph.details({
  //     edgeDataToJSON: () => ({}),
  //     keyToString: (key) => key.label.toString(),
  //     nodeDataToJSON: ({ label, mnemonic }) => ({
  //       label: label.toString(),
  //       mnemonic,
  //     }),
  //   }),
  // };

  // console.log(details);

  return providers;
}
