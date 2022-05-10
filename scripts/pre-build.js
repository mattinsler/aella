import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { findProjects } from './find-projects.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const tsconfigFile = path.join(ROOT, 'tsconfig.json');
const { projects } = findProjects(ROOT);

fs.writeFileSync(
  tsconfigFile,
  JSON.stringify(
    {
      files: [],
      references: projects.map((project) => ({
        path: path.join(path.relative(ROOT, project.srcDir), 'tsconfig.json'),
      })),
    },
    null,
    2
  ),
  'utf-8'
);
