export type OptionsValue = string | number | boolean | null | undefined | Array<OptionsValue> | Options;

export interface Options {
  [key: string]: OptionsValue;
}

export interface TargetConfig {
  type: string;
  assets: string[];
  entry: string;
  isDefault: boolean;
  name: string;
  options: Options;
  project: ProjectConfig;
}

export interface ProjectOptions extends Options {
  build?: {
    builder?: 'esbuild' | 'tsc';
  };
  package?: {
    container?: {
      registry?: string;
      repository?: string;
    };
  };
}

export interface ProjectConfig {
  configFile: string;
  name: string;
  options: ProjectOptions;
  rootDir: string;
  targets: Map<string, TargetConfig>;
}

export interface WorkspaceConfig {
  distDir: string;
  package?: {
    container?: {
      registry?: string;
    };
  };
  project: {
    config: {
      filename: string;
    };
    ignore: {
      dirname: string[];
      filename: string[];
    };
  };
  rootDir: string;
}
