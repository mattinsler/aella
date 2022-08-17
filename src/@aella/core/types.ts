import type FluentJsonSchema from 'fluent-json-schema';
import type { ObjectSchema } from 'fluent-json-schema';

import type { Label } from './label';
import type { Provider } from './providers';
import type { Directory, File } from './files';
import type { ActionContext, Kernel } from './kernel';
import type { Project, Target, Workspace } from './json-schema';
import type { BuildStep, BuildStepContext } from './build-graph';

export type { ActionContext, BuildStep, BuildStepContext, Directory, File, Kernel, Label, Provider };

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
  config: any;
  sources: File[];
  project: ProjectConfig;
}

export interface Builder {
  build: (context: BuildStepContext, opts: BuildOptions) => Provider[];
  extractDependencies?: (opts: BuildOptions) => Promise<Dependency[]>;
  name: string;
  configSchema?: ObjectSchema;
}

export interface BundleOptions {
  config: any;
  data: Provider[];
  target: TargetConfig;
}

export interface Bundler {
  bundle: (context: BuildStepContext, opts: BundleOptions) => Provider[];
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

export interface BuildOptionsConfig {
  type: string;
  config: any;
}

export interface BundleOptionsConfig {
  type: string;
  target?: string;
  config: any;
}

export interface ProjectConfig {
  type: 'project';
  build: BuildOptionsConfig;
  configFile: string;
  // other project names this project depends on
  dependencies: {
    build: string[];
    lint: string[];
  };
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
  test: boolean;
  workspace: WorkspaceConfig;
}

export interface TargetConfig {
  type: 'target';
  bundle: BundleOptionsConfig;
  isDefault: boolean;
  name: string;
  originalConfig: Json;
  project: ProjectConfig;
}

export interface WorkspaceConfig {
  addBuilder(builder: Builder): void;

  getBuilder(project: ProjectConfig, throwOnMissing: true): Builder;
  getBuilder(name: string, throwOnMissing: true): Builder;
  getBuilder(project: ProjectConfig): Builder | undefined;
  getBuilder(name: string): Builder | undefined;

  addBundler(bundler: Bundler): void;

  getBundler(target: TargetConfig, throwOnMissing: true): Bundler;
  getBundler(name: string, throwOnMissing: true): Bundler;
  getBundler(target: TargetConfig): Bundler | undefined;
  getBundler(name: string): Bundler | undefined;

  readonly allBuilders: ReadonlyArray<Builder>;
  readonly allBundlers: ReadonlyArray<Bundler>;

  commands: Command[];
  defaults: {
    build: { [builderType: string]: any };
    bundle: { [bundlerType: string]: any };
  };
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

export interface Sandbox {
  readonly rootDir: string;

  build(): Promise<void>;
  symlink(file: string, target: string): void;
  writeFile(file: string, content: string, encoding: BufferEncoding): void;
}
