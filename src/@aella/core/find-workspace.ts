import path from 'path';
import memo from 'memoizee';
import escalade from 'escalade/sync';

export const WORKSPACE_FILENAME = 'workspace.json';

export const findWorkspaceRoot = memo(function findWorkspaceRoot(fromDir: string) {
  const root = escalade(fromDir, (dir, names) => {
    if (names.includes(WORKSPACE_FILENAME)) {
      return dir;
    }
  });

  if (!root) {
    throw new Error(`Could not find workspace root directory from: ${fromDir}.`);
  }

  return root;
});

export function findWorkspaceConfigPath(fromDir: string) {
  return path.join(findWorkspaceRoot(fromDir), WORKSPACE_FILENAME);
}
