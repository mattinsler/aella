import type { ProjectConfig, TargetConfig } from './types';

export interface Label {
  readonly project: string;
  readonly target?: string;
}

interface LabelStatic {
  compare(lhs: Label, rhs: Label): number;
  equals(lhs: Label, rhs: Label): boolean;
  from(label: string, labelContext?: Label): Label;
  from(projectOrTarget: ProjectConfig | TargetConfig): Label;
  isLabel(label: string): boolean;
  toString(label: Label): string;
}

const PROJECT_AND_TARGET_RX = /^\/\/(?<project>([^\/:]+\/)*[^\/:]+)(:(?<target>[^\/:.]+))?$/;
const TARGET_ONLY_RX = /^(?<target>[^\/:.]+)$/;

function parseLabel(label: string): { project?: string; target?: string } {
  let match = PROJECT_AND_TARGET_RX.exec(label);
  if (match) {
    return {
      project: match.groups!.project,
      target: match.groups!.target,
    };
  }
  match = TARGET_ONLY_RX.exec(label);
  if (match) {
    return {
      target: match.groups!.target,
    };
  }
  return {};
}

const internedLabels = new Map<string, Label>();

function labelFrom(
  labelOrProjectOrTarget: string | ProjectConfig | TargetConfig,
  labelContext?: Label
): { project: string; target?: string } {
  if (typeof labelOrProjectOrTarget === 'string') {
    const { project, target } = parseLabel(labelOrProjectOrTarget);
    if (project) {
      return {
        project,
        target,
      };
    } else if (target && labelContext) {
      return {
        project: labelContext.project,
        target,
      };
    }
    throw new Error(`"${labelOrProjectOrTarget}" is not a valid label format`);
  } else if (labelOrProjectOrTarget.type === 'project') {
    return {
      project: labelOrProjectOrTarget.name,
    };
  } else {
    return {
      project: labelOrProjectOrTarget.project.name,
      target: labelOrProjectOrTarget.name,
    };
  }
}

export const Label: LabelStatic = {
  compare(lhs, rhs) {
    return Label.toString(lhs).localeCompare(Label.toString(rhs));
  },
  equals(lhs, rhs) {
    return lhs.project === rhs.project && lhs.target === rhs.target;
  },
  from(labelOrProjectOrTarget: string | ProjectConfig | TargetConfig, labelContext?: Label) {
    const { project, target } = labelFrom(labelOrProjectOrTarget, labelContext);
    const key = Label.toString({ project, target });
    let label = internedLabels.get(key);
    if (!label) {
      const data = { project, target };
      Object.defineProperty(data, 'toString', {
        enumerable: false,
        value: () => key,
      });
      label = Object.freeze<Label>(data);
      internedLabels.set(key, label);
    }
    return label;
  },
  isLabel(label) {
    return PROJECT_AND_TARGET_RX.test(label);
  },
  toString(label) {
    if (label.target) {
      return `//${label.project}:${label.target}`;
    }
    return `//${label.project}`;
  },
};
