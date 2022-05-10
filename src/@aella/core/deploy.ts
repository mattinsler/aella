import type { ProjectConfig, TargetConfig } from './types';

export function deployerForProject(project: ProjectConfig) {
  const { deployers } = project.workspace;

  if (deployers.length === 0) {
    throw new Error('No deployers are registered.');
  }

  if (project.deploy) {
    const deployer = deployers.find((b) => b.name === project.deploy);
    if (deployer) {
      return deployer;
    }
  } else if (deployers.length === 1) {
    // could we figure out an appropriate builder for the project type?
    return deployers[0];
  }

  throw new Error(`Project ${project.name} does not have a deployer configured.`);
}

export async function deploy({ project, target }: { project: ProjectConfig; target?: TargetConfig | null }) {
  const deployer = deployerForProject(project);
  await deployer.deploy({ project, target: target || undefined });
}
