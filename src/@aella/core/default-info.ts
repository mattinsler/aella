import { Provider, Providers } from './providers.js';

import type { File } from './types';

export const DefaultInfo = Providers.create<{
  executables?: File[];
  files: File[];
}>('DefaultInfo').extend({
  aggregate(providers: Provider[]) {
    return DefaultInfo({
      executables: DefaultInfo.executables(providers),
      files: DefaultInfo.files(providers),
    });
  },

  executables(providers: Provider[]): File[] {
    const executables: File[] = [];

    for (const provider of providers) {
      if (Providers.is(provider, DefaultInfo) && provider.executables) {
        executables.push(...provider.executables);
      }
    }

    return executables;
  },

  files(providers: Provider[]): File[] {
    const files: File[] = [];

    for (const provider of providers) {
      if (Providers.is(provider, DefaultInfo)) {
        files.push(...provider.files);
      }
    }

    return files;
  },
});
