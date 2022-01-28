import type { Options } from '../types.js';

export type RawTargetConfig = string | { entry: string; assets?: string[]; options?: Options };

export interface RawProjectConfig {
  options?: {
    build?: {
      builder?: 'esbuild' | 'tsc';
    };
    package?: {
      container?: {
        registry?: string;
        repository?: string;
      };
    };
  };
  targets?: {
    [targetName: string]: RawTargetConfig;
  };
}

export interface RawWorkspaceConfig {
  distDir?: string;
  package?: {
    container?: {
      registry?: string;
    };
  };
  project?: {
    config?: {
      filename?: string;
    };
    ignore?: {
      dirname?: string[];
      filename?: string[];
    };
  };
}
