import type { File } from './types';
import type { Label } from './label';
import type { Edge, Graph, Node } from './graph';

import { createGraph } from './graph.js';

export type ActionGraph = Graph<string, string, Action<any>>;
export type ActionNode = Node<string, string, Action<any>>;
export type ActionEdge = Edge<string, string, Action<any>>;

export interface Action<TConfig> {
  inputs: File[];
  outputs: File[];

  config: TConfig;
  execute: <TConfig>(config: TConfig) => Promise<void>;
  label: Label;
  mnemonic: string;
}

export function createActionGraph(): ActionGraph {
  return createGraph<string, string, Action<any>>();
}
