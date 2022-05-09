import fs from 'node:fs';
import path from 'node:path';

import type { WorkspaceConfig } from './types';

import { writeFileSync } from './fs-utils.js';

function ensureMetaDir(workspace: Pick<WorkspaceConfig, 'metaDir'>) {
  const stat = fs.statSync(workspace.metaDir, {
    throwIfNoEntry: false,
  });

  if (stat) {
    if (!stat.isDirectory()) {
      throw new Error(`The metadata path exists, but is not a directory: ${workspace.metaDir}.`);
    }
  } else {
    fs.mkdirSync(workspace.metaDir, { recursive: true });
  }
}

export function generateJsonSchema(workspace: Pick<WorkspaceConfig, 'metaDir' | 'schemas'>) {
  ensureMetaDir(workspace);

  writeFileSync(
    path.join(workspace.metaDir, 'project.schema.json'),
    JSON.stringify(workspace.schemas.project.schema.toJSON(), null, 2),
    'utf-8'
  );
  writeFileSync(
    path.join(workspace.metaDir, 'workspace.schema.json'),
    JSON.stringify(workspace.schemas.workspace.schema.toJSON(), null, 2),
    'utf-8'
  );
}
