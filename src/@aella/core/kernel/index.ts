import { createActionGraph } from './action-graph.js';
import { createDirectory, createFile } from '../files.js';

import type { ActionContext, ActionExecution } from './action-graph';
import type { Directory, File, ProjectConfig, TargetConfig, WorkspaceConfig } from '../types';

export type { ActionContext };

export interface Kernel {
  readonly workspace: WorkspaceConfig;

  directory(path: string, root: string): Directory;
  file(path: string, root: string): File;
  file(file: File, root: string): File;
  file(file: Directory, root: string): Directory;

  materialize(files: File[]): Promise<void>;

  task<TConfig>(
    fn: ActionExecution<TConfig>,
    opts: { config: TConfig; inputs: File[]; outputs: File[]; project?: ProjectConfig; target?: TargetConfig },
    mnemonic?: string
  ): void;

  // run<T, U>(fn: (kernel: Kernel, ...args: T[]) => U, ...args: T[]): U;
}

export function createKernel(workspace: WorkspaceConfig): Kernel {
  const actionGraph = createActionGraph();

  return {
    workspace,

    directory: createDirectory,
    file: createFile,

    async materialize(files: File[]) {
      // prune graph, execute new graph
      await actionGraph.execute();
    },

    task(execute, opts, mnemonic) {
      const action = {
        config: opts.config,
        context: {
          inputs: opts.inputs,
          outputs: opts.outputs,
          project: opts.project,
          target: opts.target,
          workspace,
        },
        execute,
        mnemonic: mnemonic || actionGraph.generateActionMnemonic(),
      };

      actionGraph.addAction(action);
    },
  };
}
