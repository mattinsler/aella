import fs from 'fs';
import Ajv from 'ajv';
import path from 'path';
import JSONC from 'jsonc-parser';
import { fileURLToPath } from 'url';

import type { ProjectConfig } from '../types.js';
import type { RawProjectConfig } from './raw-types.js';

import { parseTargetConfig } from './target-config.js';

const PROJECT_JSON_SCHEMA = JSON.parse(
  fs.readFileSync(path.join(fileURLToPath(import.meta.url), '..', '..', '..', 'project.schema.json'), 'utf-8')
);

const ajv = new Ajv();
const validate = ajv.compile(PROJECT_JSON_SCHEMA);

export function parseAndValidateConfig({ content, filename }: { content: string; filename: string }): RawProjectConfig {
  const data = JSONC.parse(content);

  const valid = validate(data);
  if (!valid) {
    throw new Error(`[${filename}: ${validate.errors}`);
  }

  return data as RawProjectConfig;
}

export function parseProjectConfig(
  content: string,
  { filename, rootDir }: { filename: string; rootDir: string }
): ProjectConfig {
  const data = parseAndValidateConfig({ content, filename });

  const config: ProjectConfig = {
    configFile: filename,
    name: path.relative(rootDir, path.dirname(filename)),
    options: data.options || {},
    rootDir: path.dirname(filename),
    targets: new Map(),
  };

  if (data.targets) {
    const targetNames = Object.keys(data.targets);
    targetNames.sort();
    for (const targetName of targetNames) {
      config.targets.set(
        targetName,
        parseTargetConfig(data.targets[targetName], { name: targetName, project: config })
      );
    }
  }

  return config;
}

export async function readProjectConfig(filename: string, rootDir: string): Promise<ProjectConfig | null> {
  try {
    return parseProjectConfig(await fs.promises.readFile(filename, 'utf-8'), { filename, rootDir });
  } catch (err) {
    if ((err as any).code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

export function readProjectConfigSync(filename: string, rootDir: string): ProjectConfig | null {
  try {
    return parseProjectConfig(fs.readFileSync(filename, 'utf-8'), { filename, rootDir });
  } catch (err) {
    if ((err as any).code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}
