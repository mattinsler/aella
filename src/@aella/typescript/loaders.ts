import type { Loader } from 'esbuild';

export const LOADERS: Record<string, Loader> = {
  '.js': 'js',
  '.cjs': 'js',
  '.mjs': 'js',
  '.jsx': 'jsx',
  '.ts': 'ts',
  '.cts': 'ts',
  '.mts': 'ts',
  '.tsx': 'tsx',
};
