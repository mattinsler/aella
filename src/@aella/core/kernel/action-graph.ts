import fs from 'node:fs';

import type { File, ProjectConfig, TargetConfig, WorkspaceConfig } from '../types';

export interface ActionContext {
  inputs: File[];
  outputs: File[];
  project?: ProjectConfig;
  target?: TargetConfig;
  workspace: WorkspaceConfig;
}

export interface ActionExecution<TConfig> {
  (config: TConfig): Promise<void>;
}

export interface Action {
  config: any;
  context: ActionContext;
  execute: ActionExecution<any>;
  mnemonic: string;
}

interface Node {
  action: Action;
  inputs: Set<Node>;
  inputFiles: Set<string>;
  outputFiles: Set<string>;
}

export function createActionGraph() {
  const actions = new Set<Action>();
  const actionNodes = new Map<Action, Node>();

  let lastActionId = 0;

  return {
    addAction(action: Action) {
      if (!actions.has(action)) {
        const node: Node = {
          action,
          inputs: new Set(),
          inputFiles: new Set(action.context.inputs.map((file) => file.absolutePath)),
          outputFiles: new Set(action.context.outputs.map((file) => file.absolutePath)),
        };

        for (const actionNode of actionNodes.values()) {
          for (const file of node.inputFiles) {
            if (actionNode.outputFiles.has(file)) {
              node.inputs.add(actionNode);
            }
          }
          for (const file of actionNode.inputFiles) {
            if (node.outputFiles.has(file)) {
              actionNode.inputs.add(node);
            }
          }
        }

        actions.add(action);
        actionNodes.set(action, node);
      }
    },

    createDotFile(filename: string) {
      const lines: string[] = [];

      for (const action of actions) {
        for (const file of action.context.inputs) {
          lines.push(`  "${file.absolutePath}" -> "${action.mnemonic}";`);
        }
        for (const file of action.context.outputs) {
          lines.push(`  "${action.mnemonic}" -> "${file.absolutePath}";`);
        }
      }

      lines.unshift('digraph actions {');
      lines.push('}');

      fs.writeFileSync(filename, lines.join('\n'), 'utf-8');
    },

    generateActionMnemonic() {
      return `Action ${lastActionId++}`;
    },

    execute() {
      const nodes = new Set(actionNodes.values());
      const numTotalNodes = nodes.size;
      const completedNodes = new Set<Node>();

      return new Promise<void>((resolve, _reject) => {
        function next() {
          if (numTotalNodes === completedNodes.size) {
            return resolve();
          }

          const nodesToExecute = Array.from(nodes).filter((node) => {
            if (node.inputs.size === 0) {
              return true;
            }
            if (Array.from(node.inputs).some((inputNode) => !completedNodes.has(inputNode))) {
              return false;
            }
            return true;
          });

          // execute nodes
          nodesToExecute.forEach(async (node) => {
            nodes.delete(node);
            console.log(`Execute ${node.action.mnemonic}...`);
            await node.action.execute(node.action.config);
            completedNodes.add(node);
            next();
          });

          // need to check for starvation...
        }

        next();
      });
    },
  };
}
