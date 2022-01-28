import type { Context } from '../context.js';
import type { TargetConfig } from '../types.js';

export interface Executor {
  type: string;
  execute(opts: { context: Context; target: TargetConfig; argv: string[] }): Promise<void>;
  handles(filename: string): boolean;
}
