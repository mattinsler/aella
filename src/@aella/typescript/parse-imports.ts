import path from 'node:path';
import precinct from 'precinct';
import isBuiltinModule from 'is-builtin-module';

interface Dependency {
  end: number;
  start: number;
  value: string;
}

function parseImportsFromFile(content: string, file: string): string[] {
  const ext = path.extname(file);

  const deps = precinct(content, {
    type: ext === '.cjs' ? 'commonjs' : ext.startsWith('.js') ? undefined : ext.slice(1),
  }).filter((dep) => !isBuiltinModule(dep));

  return deps;
}

export function parseImportsWithLocation(content: string, file: string): Dependency[] {
  let lastIndex = 0;
  const deps = parseImportsFromFile(content, file).map((dep): Dependency => {
    const idx = content.indexOf(dep, lastIndex);
    lastIndex = idx + dep.length;
    return {
      end: idx + dep.length,
      start: idx,
      value: dep,
    };
  });

  if (file.includes('trailing-extractor')) {
    console.log(file);
    console.log(deps);
  }

  return deps;
}

export function parseImports(content: string, file: string) {
  return Array.from(new Set(parseImportsFromFile(content, file)));
}
