import fs from 'node:fs';
import path from 'node:path';
import { generateJsonSchema, utils } from '@aella/core';

import type { Command, WorkspaceConfig } from '@aella/core';

function updateVSCodeSettings(rootDir: string) {
  const file = path.join(rootDir, '.vscode', 'settings.json');

  fs.mkdirSync(path.dirname(file), { recursive: true });
  const settings = JSON.parse(fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : '{}');

  if (!settings['json.schemas']) {
    settings['json.schemas'] = [];
  }

  if (
    (settings['json.schemas'] as Array<{ fileMatch: string[]; url: string }>).find(
      (item) =>
        item.fileMatch.length === 1 && item.fileMatch[0] === 'project.json' && item.url === '.aella/project.schema.json'
    ) == null
  ) {
    settings['json.schemas'].push({
      fileMatch: ['project.json'],
      url: '.aella/project.schema.json',
    });
  }
  if (
    (settings['json.schemas'] as Array<{ fileMatch: string[]; url: string }>).find(
      (item) =>
        item.fileMatch.length === 1 &&
        item.fileMatch[0] === 'workspace.json' &&
        item.url === '.aella/workspace.schema.json'
    ) == null
  ) {
    settings['json.schemas'].push({
      fileMatch: ['workspace.json'],
      url: '.aella/workspace.schema.json',
    });
  }

  utils.writeFileSync(file, JSON.stringify(settings, null, 2), 'utf-8');
}

async function execute(workspace: Pick<WorkspaceConfig, 'metaDir' | 'rootDir' | 'schemas'>, argv: string[]) {
  utils.writeFileSync(path.join(workspace.rootDir, 'workspace.json'), JSON.stringify({}, null, 2), 'utf-8');
  generateJsonSchema(workspace);
  updateVSCodeSettings(workspace.rootDir);

  return 0;
}

export const init: Command = {
  aliases: [],
  args: [],
  execute,
  name: 'init',
  description: '',
};
