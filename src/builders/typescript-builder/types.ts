import type { ProjectConfig, WorkspaceConfig } from '../../types';

export interface BuildContext {
  project: ProjectConfig;
  workspace: WorkspaceConfig;
}
