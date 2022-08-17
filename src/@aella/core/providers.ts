interface InternalProvider {
  readonly __provider: Symbol;
}
export type Provider<T = {}> = Readonly<T>;

export interface ProviderCreator<T> {
  (values: T): Provider<T>;

  readonly __provider: Symbol;
  extend<U>(extension: U): ProviderCreator<T> & U;
}

function createProvider<T>(name: string) {
  const __provider = Symbol(name);

  function provider(value: T) {
    return Object.freeze({
      __provider,
      ...value,
    });
  }

  function extend<U>(extension: U) {
    return Object.assign(createProvider(name), extension);
  }

  return Object.assign(provider, {
    __provider,
    extend,
  });
}

export const Providers = {
  create<T>(name: string): ProviderCreator<T> {
    // @ts-expect-error
    return createProvider(name);
  },

  is<T>(value: Provider, provider: ProviderCreator<T>): value is Provider<T> {
    return value && (value as InternalProvider).__provider === provider.__provider;
  },
};
