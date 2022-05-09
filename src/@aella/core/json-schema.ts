import Ajv from 'ajv';
import S from 'fluent-json-schema';

import type { ErrorObject } from 'ajv';
import type { JSONSchema } from 'fluent-json-schema';

const ajv = new Ajv({ allErrors: true });

export interface Schema<T = any> {
  readonly schema: JSONSchema & { toJSON(): object };

  validate(value: any):
    | {
        errors: ErrorObject<string, Record<string, any>, unknown>[] | null | undefined;
        valid: false;
      }
    | {
        valid: true;
        value: T;
      };
}

export function createSchema<T>(config: { readonly schema: JSONSchema }): Schema<T> {
  return {
    get schema() {
      return {
        ...config.schema,
        toJSON: () => config.schema.valueOf(),
      };
    },

    validate(value) {
      const validator = ajv.compile(config.schema.valueOf());
      const valid = validator(value);

      if (valid) {
        return {
          valid: true,
          value: value as T,
        };
      }

      return {
        errors: validator.errors,
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
  get schema() {
    return S.oneOf([
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
    ]);
  },
});

export type TargetSchema = string;

export const Target = createSchema<TargetSchema>({
  get schema() {
    return S.string();
  },
});

export interface ProjectSchema {
  assets?: GlobSchema;
  build?: (string | { type: string })[];
  dependencies?: {
    build?: string[];
    lint?: string[];
  };
  deploy?: (string | { type: string })[];
  srcs?: GlobSchema;
  targets?: Record<string, TargetSchema>;
}

export const Project = (() => {
  const buildSchemas: JSONSchema[] = [];
  const deploySchemas: JSONSchema[] = [];

  return {
    get buildSchemas() {
      return buildSchemas;
    },

    get deploySchemas() {
      return deploySchemas;
    },

    ...createSchema<ProjectSchema>({
      get schema() {
        return S.object()
          .prop('assets', Glob.schema)
          .prop('build', S.oneOf(buildSchemas))
          .prop(
            'dependencies',
            S.object().prop('build', S.array().items(S.string())).prop('lint', S.array().items(S.string()))
          )
          .prop('deploy', S.oneOf(deploySchemas))
          .prop('srcs', Glob.schema)
          .prop('targets', S.object().additionalProperties(Target.schema));
      },
    }),
  };
})();

export interface WorkspaceSchema {
  distDir?: string;
  plugins?: string[];
  project?: {
    config?: {
      filename?: string;
    };
  };
}

export const Workspace = createSchema<WorkspaceSchema>({
  get schema() {
    return S.object()
      .prop('distDir', S.string())
      .prop('plugins', S.array().items(S.string()))
      .prop('project', S.object().prop('config', S.object().prop('filename', S.string())));
  },
});
