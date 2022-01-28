import type { Executor } from './types';

import { shellExecutor } from './shell-executor.js';
import { javascriptExecutor } from './javascript-executor.js';
import { typescriptExecutor } from './typescript-executor.js';

const executorList = [shellExecutor, javascriptExecutor, typescriptExecutor];
const executorMap = new Map(executorList.map((executor) => [executor.type, executor]));

export function getExecutor(type: string): Executor | null {
  return executorMap.get(type) || null;
}

export function getExecutorForFile(filename: string): Executor | null {
  return executorList.find((e) => e.handles(filename)) || null;
}
