import type FluentJsonSchema from 'fluent-json-schema';
import type { ObjectSchema } from 'fluent-json-schema';
import type { Project, Target, Workspace } from './json-schema';

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export type TargetPluginFn = (config: TargetConfig) => void;
export type ProjectPluginFn = (config: ProjectConfig) => void;
export type WorkspacePluginFn = (config: WorkspaceConfig, fluentJsonSchema: typeof FluentJsonSchema) => void;

export interface PluginContext {
  onProjectConfig: (fn: ProjectPluginFn) => void;
  onTargetConfig: (fn: TargetPluginFn) => void;
  onWorkspaceConfig: (fn: WorkspacePluginFn) => void;
}

export type Plugin = (context: PluginContext) => void;

export interface Dependency {
  // build dependency
  build: boolean;
  // lint dependency (include type-checking)
  lint: boolean;
  // normalized dependency string
  value: string;
}

export interface BuildOptions {
  files: {
    assets: string[];
    sources: string[];
  };
  project: ProjectConfig;
  target?: TargetConfig;
}

export interface Builder {
  build: (opts: BuildOptions) => Promise<{
    inputs: string[];
    outputs: string[];
  }>;
  extractDependencies?: (opts: BuildOptions) => Promise<Dependency[]>;
  name: string;
  configSchema?: ObjectSchema;
}

export interface DeployOptions {
  project: ProjectConfig;
  target?: TargetConfig;
}

export interface Deployer {
  deploy(opts: DeployOptions): Promise<void>;
  name: string;
  configSchema?: ObjectSchema;
}

export interface Command {
  execute: (workspace: WorkspaceConfig, argv: string[]) => Promise<number>;

  readonly aliases: string[];
  readonly args: string[];
  readonly description: string;
  readonly name: string;
}

export interface Glob {
  exclude?: {
    directories?: string[];
    files?: string[];
  };
  include?: {
    directories?: string[];
    files?: string[];
  };
}

export interface CommandOptionsConfig {
  type: string;
  config: any;
}

export interface ProjectConfig {
  build?: CommandOptionsConfig;
  configFile: string;
  // other project names this project depends on
  dependencies: {
    build: string[];
    lint: string[];
  };
  deploy?: CommandOptionsConfig;
  distDir: string;
  // call filesFromProject to get sources and assets paths
  files: {
    assets: Glob;
    sources: Glob;
  };
  name: string;
  // options: ProjectOptions;
  originalConfig: Json;
  rootDir: string;
  targets: Map<string, TargetConfig>;
  workspace: WorkspaceConfig;
}

export interface TargetConfig {
  assets: string[];
  entry: string;
  isDefault: boolean;
  name: string;
  originalConfig: Json;
  project: ProjectConfig;
  // type: string;
}

export interface WorkspaceConfig {
  builders: Builder[];
  commands: Command[];
  defaults: {
    build: { [builderType: string]: any };
    deploy: { [deployerType: string]: any };
  };
  deployers: Deployer[];
  distDir: string;
  metaDir: string;
  // package?: {
  //   container?: {
  //     registry?: string;
  //   };
  // };
  originalConfig: Json;
  plugins: Plugin[];
  pluginHooks: {
    onProjectConfig: ProjectPluginFn[];
    onTargetConfig: TargetPluginFn[];
    onWorkspaceConfig: WorkspacePluginFn[];
  };
  project: {
    config: {
      filename: string;
    };
    // ignore: {
    //   dirname: string[];
    //   filename: string[];
    // };
  };
  rootDir: string;
  schemas: {
    project: typeof Project;
    target: typeof Target;
    workspace: typeof Workspace;
  };
}
