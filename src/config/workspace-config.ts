import fs from 'fs';
import Ajv from 'ajv';
import path from 'path';
import memo from 'memoizee';
import getValue from 'get-value';
import JSONC from 'jsonc-parser';
import { fileURLToPath } from 'url';
import escalade from 'escalade/sync';

import type { WorkspaceConfig } from '../types.js';
import type { RawWorkspaceConfig } from './raw-types.js';

const WORKSPACE_JSON_SCHEMA = JSON.parse(
  fs.readFileSync(path.join(fileURLToPath(import.meta.url), '..', '..', '..', 'workspace.schema.json'), 'utf-8')
);

const ajv = new Ajv();
const validate = ajv.compile(WORKSPACE_JSON_SCHEMA);

export const findWorkspaceDir = memo(function findWorkspaceDir(fromDir: string) {
  const root = escalade(fromDir, (dir, names) => {
    if (names.includes('workspace.json')) {
      return dir;
    }
  });

  if (!root) {
    throw new Error(`Could not find root directory from: ${fromDir}.`);
  }

  return root;
});

export function parseAndValidateConfig({
  content,
  filename,
}: {
  content: string;
  filename: string;
}): RawWorkspaceConfig {
  const data = JSONC.parse(content);

  const valid = validate(data);
  if (!valid) {
    throw new Error(`[${filename}: ${validate.errors}`);
  }

  return data as RawWorkspaceConfig;
}

export function parseWorkspaceConfig(content: string, workspaceDir: string): WorkspaceConfig {
  const data = parseAndValidateConfig({ content, filename: path.join(workspaceDir, 'workspace.json') });

  const config: WorkspaceConfig = {
    distDir: path.join(workspaceDir, data.distDir ? data.distDir : 'dist'),
    project: {
      config: {
        filename: getValue(data, 'project.config.filename', { default: 'project.json' }),
      },
      ignore: {
        dirname: ['.git', 'node_modules'].concat(getValue(data, 'project.ignore.dirname', { default: [] })),
        filename: ([] as string[]).concat(getValue(data, 'project.ignore.filename', { default: [] })),
      },
    },
    rootDir: workspaceDir,
  };

  const packageContainerRegistry = getValue(data, 'package.container.registry');
  if (packageContainerRegistry) {
    config.package = {
      container: {
        registry: packageContainerRegistry,
      },
    };
  }

  return config;
}

export function readWorkspaceConfigSync(workspaceDir: string): WorkspaceConfig | null {
  try {
    return parseWorkspaceConfig(fs.readFileSync(path.join(workspaceDir, 'workspace.json'), 'utf-8'), workspaceDir);
  } catch (err) {
    if ((err as any).code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}
