import Ajv from 'ajv';
import S from 'fluent-json-schema';
import betterAjvErrors from 'better-ajv-errors';

import type { ErrorObject } from 'ajv';
import type { JSONSchema } from 'fluent-json-schema';

import { WorkspaceConfig } from './types';

const ajv = new Ajv({ allErrors: true });

export interface Schema<T = any> {
  schema(workspace: WorkspaceConfig): JSONSchema & { toJSON(): object };

  validate(
    workspace: WorkspaceConfig,
    value: any
  ):
    | {
        errors: ErrorObject<string, Record<string, any>, unknown>[] | null | undefined;
        formattedErrors: string;
        valid: false;
      }
    | {
        valid: true;
        value: T;
      };
}

export function createSchema<T>(config: { schema: (workspace: WorkspaceConfig) => JSONSchema }): Schema<T> {
  return {
    schema(workspace) {
      return {
        ...config.schema(workspace),
        toJSON: () => config.schema(workspace).valueOf(),
      };
    },

    validate(workspace, value) {
      const validator = ajv.compile(config.schema(workspace).valueOf());
      const valid = validator(value);

      if (valid) {
        return {
          valid: true,
          value: value as T,
        };
      }

      return {
        errors: validator.errors,
        formattedErrors: betterAjvErrors(config.schema(workspace), value, validator.errors!),
        valid: false,
      };
    },
  };
}

export type GlobSchema =
  | string[]
  | {
      exclude?: {
        directories?: string[];
        files?: string[];
      };
      include?: {
        directories?: string[];
        files?: string[];
      };
    };

export const Glob = createSchema<GlobSchema>({
  schema: () =>
    S.oneOf([
      S.array().items(S.string()),
      S.object()
        .prop(
          'exclude',
          S.object().prop('directories', S.array().items(S.string())).prop('files', S.array().items(S.string()))
        )
        .prop(
          'include',
          S.object().prop('directories', S.array().items(S.string())).prop('files', S.array().items(S.string()))
        ),
    ]),
});

export type CommandOptionsSchema = string | { type: string; config?: object };

export const CommandOptions = createSchema<CommandOptionsSchema>({
  schema: () =>
    S.oneOf([
      S.string(),
      S.object().prop('type', S.string()).prop('config', S.object().additionalProperties(true)).required(['type']),
    ]),
});

export type TargetSchema = string;

export const Target = createSchema<TargetSchema>({
  schema: () => S.string(),
});

export interface ProjectSchema {
  assets?: GlobSchema;
  build?: CommandOptionsSchema;
  dependencies?: {
    build?: string[];
    lint?: string[];
  };
  deploy?: CommandOptionsSchema;
  srcs?: GlobSchema;
  targets?: Record<string, TargetSchema>;
  test?: boolean;
}

export const Project = createSchema<ProjectSchema>({
  schema: (workspace) => {
    const buildSchemas: JSONSchema[] = [];
    const deploySchemas: JSONSchema[] = [];

    workspace.builders.forEach((builder) => {
      buildSchemas.push(S.string().enum([builder.name]));
      if (builder.configSchema) {
        buildSchemas.push(
          S.object()
            .prop('type', S.string().enum([builder.name]))
            .prop('config', builder.configSchema)
        );
      }
    });

    workspace.deployers.forEach((deployer) => {
      deploySchemas.push(S.string().enum([deployer.name]));
      if (deployer.configSchema) {
        deploySchemas.push(
          S.object()
            .prop('type', S.string().enum([deployer.name]))
            .prop('config', deployer.configSchema)
        );
      }
    });

    return S.object()
      .prop('assets', Glob.schema(workspace))
      .prop('build', S.oneOf(buildSchemas))
      .prop(
        'dependencies',
        S.object().prop('build', S.array().items(S.string())).prop('lint', S.array().items(S.string()))
      )
      .prop('deploy', S.oneOf(deploySchemas))
      .prop('srcs', Glob.schema(workspace))
      .prop('targets', S.object().additionalProperties(Target.schema(workspace)))
      .prop('test', S.boolean());
  },
});

export interface WorkspaceSchema {
  defaults?: {
    build?: { [builderType: string]: any };
    deploy?: { [deployerType: string]: any };
  };
  distDir?: string;
  plugins?: string[];
  project?: {
    config?: {
      filename?: string;
    };
  };
}

export const Workspace = createSchema<WorkspaceSchema>({
  schema: (workspace) => {
    let buildDefaults = S.object();
    let deployDefaults = S.object();

    workspace.builders.forEach((builder) => {
      if (builder.configSchema) {
        buildDefaults = buildDefaults.prop(builder.name, builder.configSchema);
      }
    });

    workspace.deployers.forEach((deployer) => {
      if (deployer.configSchema) {
        deployDefaults = deployDefaults.prop(deployer.name, deployer.configSchema);
      }
    });

    return S.object()
      .prop('defaults', S.object().prop('build', buildDefaults).prop('deploy', deployDefaults))
      .prop('distDir', S.string())
      .prop('plugins', S.array().items(S.string()))
      .prop('project', S.object().prop('config', S.object().prop('filename', S.string())));
  },
});
