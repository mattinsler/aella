import path from 'path';
import { execa } from 'execa';
import stripAnsi from 'strip-ansi';

import type task from 'tasuku';
import type { BuildContext } from './types.js';

import { copyAssets } from '../../copy-assets.js';
import { lineIterator } from './line-iterator.js';

interface DiagnosticStats {
  files: number;
  lines: number;
  nodes: number;
  identifiers: number;
  symbols: number;
  types: number;
  instantiations: number;
  // in KB
  memoryUsed: number;
  // in seconds
  ioRead: number;
  // in seconds
  ioWrite: number;
  // in seconds
  parseTime: number;
  // in seconds
  bindTime: number;
  // in seconds
  checkTime: number;
  // in seconds
  emitTime: number;
  // in seconds
  totalTime: number;
}

interface ParsedTscOutput {
  diagnostics: DiagnosticStats;
  emittedFiles: string[];
  errors: string[];
}

const DIAGNOSTIC_NAME_TO_STAT_KEY: Record<string, { stat: keyof DiagnosticStats; parser: (value: string) => number }> =
  {
    Files: { stat: 'files', parser: Number },
    Lines: { stat: 'lines', parser: Number },
    Nodes: { stat: 'nodes', parser: Number },
    Identifiers: { stat: 'identifiers', parser: Number },
    Symbols: { stat: 'symbols', parser: Number },
    Types: { stat: 'types', parser: Number },
    Instantiations: { stat: 'instantiations', parser: Number },
    'Memory used': { stat: 'memoryUsed', parser: (value) => Number(value.replace(/[^0-9]+$/, '')) },
    'I/O read': { stat: 'ioRead', parser: Number.parseFloat },
    'I/O write': { stat: 'ioWrite', parser: Number.parseFloat },
    'Parse time': { stat: 'parseTime', parser: Number.parseFloat },
    'Bind time': { stat: 'bindTime', parser: Number.parseFloat },
    'Check time': { stat: 'checkTime', parser: Number.parseFloat },
    'Emit time': { stat: 'emitTime', parser: Number.parseFloat },
    'Total time': { stat: 'totalTime', parser: Number.parseFloat },
  };

function parseTscOutput(text: string): ParsedTscOutput {
  const res: ParsedTscOutput = {
    diagnostics: {} as DiagnosticStats,
    emittedFiles: [],
    errors: [],
  };

  const it = lineIterator(text);
  let currentErrorLines: string[] = [];

  function pushError() {
    if (currentErrorLines.length > 0) {
      res.errors.push(currentErrorLines.join('\n'));
      currentErrorLines = [];
    }
  }

  for (const line of it) {
    if (/^([^ ][^:]+:[0-9]+:[0-9]+ - |error TS[0-9]+: )/.test(stripAnsi(line))) {
      // start of error
      pushError();
      currentErrorLines = [line];
    } else {
      const match = line.match(/^(?<key>[a-zA-Z\/ ]+):/);
      if (match) {
        const key = match.groups!.key!;
        const diagnostic = DIAGNOSTIC_NAME_TO_STAT_KEY[key];
        if (diagnostic) {
          pushError();
          res.diagnostics[diagnostic.stat] = diagnostic.parser(line.slice(key.length + 1));
        } else if (key === 'TSFILE') {
          pushError();
          res.emittedFiles.push(line.slice(7).trim());
        }
      }

      if (currentErrorLines.length > 0) {
        // part of the current error
        currentErrorLines.push(line);
      }
    }
  }

  return res;
}

async function buildProject({
  tsc,
  tsconfig,
}: {
  tsc: string;
  tsconfig: string;
}): Promise<ParsedTscOutput & { exitCode: number; stdout: string }> {
  const { stdout, exitCode } = await execa(tsc, ['-p', tsconfig, '--listEmittedFiles', '--diagnostics', '--pretty'], {
    reject: false,
  });

  return {
    ...parseTscOutput(stdout),
    exitCode,
    stdout,
  };
}

export async function build({ project, taskHelpers, workspace }: BuildContext & { taskHelpers?: task.TaskInnerApi }) {
  const tsc = path.join(workspace.rootDir, 'node_modules', '.bin', 'ttsc');
  const tsconfig = path.join(project.rootDir, 'tsconfig.json');

  if (taskHelpers) {
    const { task } = taskHelpers;
    await task(`tsc ${tsconfig}`, async ({ setError, setStatus, setOutput }) => {
      const res = await buildProject({ tsc, tsconfig });
      const { diagnostics, errors, exitCode, stdout } = res;
      const emittedFiles = res.emittedFiles.map((file) => path.relative(workspace.rootDir, file));

      if (exitCode === 0) {
        emittedFiles.push(...(await copyAssets({ project, workspace })));
        setStatus(`${diagnostics.totalTime}s`);
        setOutput(`Emitted ${emittedFiles.length} file(s):\n${emittedFiles.map((s) => `  ${s}`).join('\n')}`);
      } else {
        setError('');
        setStatus(`${diagnostics.totalTime}s - ${errors.length} error(s)`);
        if (errors.length === 0) {
          setOutput(stdout);
        } else {
          setOutput(errors.join('\n'));
        }
      }
    });
  } else {
    await buildProject({ tsc, tsconfig });
  }
}
