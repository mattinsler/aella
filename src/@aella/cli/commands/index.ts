import type { Command, ProjectConfig, TargetConfig } from '@aella/core';

export const affected: Command = {
  aliases: [],
  args: ['FILES...'],
  execute: async (...args) => (await import('./affected-command.js')).execute(...args),
  name: 'affected',
  description: 'List projects affected by files',
};

export const build: Command = {
  aliases: [],
  args: ['PROJECT'],
  execute: async (...args) => (await import('./build-command.js')).execute(...args),
  name: 'build',
  description: 'Build a project',
};

export const fix: Command = {
  aliases: [],
  args: [],
  execute: async (...args) => (await import('./fix-command.js')).execute(...args),
  name: 'fix',
  description: 'Analyze code and fix config files',
};

export const help: Command = {
  aliases: [],
  args: [],
  execute: async (...args) => (await import('./help-command.js')).execute(...args),
  name: 'help',
  description: 'Print help information',
};

export const init: Command = {
  aliases: [],
  args: [],
  execute: async (...args) => (await import('./init-command.js')).execute(...args),
  name: 'init',
  description: '',
};

export const list: Command = {
  aliases: ['ls'],
  args: ['[projects|targets]'],
  execute: async (...args) => (await import('./list-command.js')).execute(...args),
  name: 'list',
  description: 'List available commands',
};

export const run: Command & {
  createCommand(opts: { file?: string; project: ProjectConfig; target?: TargetConfig }): Promise<Command>;
} = {
  aliases: [],
  args: ['PROJECT[:TARGET]'],
  execute: () => Promise.reject(),
  name: '',
  description: 'Run a project target',
  createCommand: async (...args) => (await import('./run-command.js')).createCommand(...args),
};

export const test: Command = {
  aliases: [],
  args: ['PROJECT'],
  execute: async (...args) => (await import('./test-command.js')).execute(...args),
  name: 'test',
  description: 'Test a project',
};
