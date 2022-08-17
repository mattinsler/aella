import { Provider, Providers } from '@aella/core';

export const NodeModuleInfo = Providers.create<{
  moduleNames: string[];
}>('NodeModuleInfo').extend({
  aggregate(providers: Provider[]) {
    return NodeModuleInfo({
      moduleNames: NodeModuleInfo.moduleNames(providers),
    });
  },

  moduleNames(providers: Provider[]): string[] {
    const moduleNames: string[] = [];

    for (const provider of providers) {
      if (Providers.is(provider, NodeModuleInfo)) {
        moduleNames.push(...provider.moduleNames);
      }
    }

    return moduleNames;
  },
});
