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
        formattedErrors: betterAjvErrors(config.schema(workspace), value, validator.errors!, {
          json: JSON.stringify(value, null, 2),
        }),
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

export interface TargetSchema {
  bundle: string;
  target?: string;
}

export const Target = createSchema<TargetSchema>({
  schema: (workspace) => {
    const schemas: JSONSchema[] = [];

    workspace.allBundlers.forEach((bundler) => {
      const bundleSchema = S.object()
        .prop('bundle', S.string().enum([bundler.name]))
        .prop('target', S.string())
        .required(['bundle']);

      if (bundler.configSchema) {
        schemas.push(bundler.configSchema.extend(bundleSchema));
      } else {
        schemas.push(bundleSchema);
      }
    });

    if (schemas.length === 0) {
      return S.object();
    }
    return S.oneOf(schemas);
  },
});

export type BuildSchema = string | { type: string };

export const Build = createSchema<BuildSchema>({
  schema: (workspace) => {
    const schemas: JSONSchema[] = [];

    workspace.allBuilders.forEach((builder) => {
      schemas.push(S.string().enum([builder.name]));
      if (builder.configSchema) {
        schemas.push(
          builder.configSchema.extend(
            S.object()
              .prop('bundle', S.string().enum([builder.name]))
              .required()
          )
        );
      }
    });

    return S.anyOf(schemas);
  },
});

export interface ProjectSchema {
  assets?: GlobSchema;
  build: BuildSchema;
  deps?: {
    [dep: string]: 'build' | 'lint';
  };
  srcs?: GlobSchema;
  targets?: Record<string, TargetSchema>;
  test?: boolean;
}

export const Project = createSchema<ProjectSchema>({
  schema: (workspace) =>
    S.object()
      .prop('assets', Glob.schema(workspace))
      .prop('build', Build.schema(workspace))
      .required()
      .prop('deps', S.object().additionalProperties(S.string().enum(['build', 'lint'])))
      .prop('srcs', Glob.schema(workspace))
      .prop('targets', S.object().additionalProperties(Target.schema(workspace)))
      .prop('test', S.boolean()),
});

export interface WorkspaceSchema {
  defaults?: {
    build?: { [builderType: string]: any };
    bundle?: { [bundlerType: string]: any };
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
    let bundleDefaults = S.object();

    workspace.allBuilders.forEach((builder) => {
      if (builder.configSchema) {
        buildDefaults = buildDefaults.prop(builder.name, builder.configSchema);
      }
    });

    workspace.allBundlers.forEach((bundler) => {
      if (bundler.configSchema) {
        bundleDefaults = bundleDefaults.prop(bundler.name, bundler.configSchema);
      }
    });

    return S.object()
      .prop('defaults', S.object().prop('build', buildDefaults).prop('bundle', bundleDefaults))
      .prop('distDir', S.string())
      .prop('plugins', S.array().items(S.string()))
      .prop('project', S.object().prop('config', S.object().prop('filename', S.string())));
  },
});
