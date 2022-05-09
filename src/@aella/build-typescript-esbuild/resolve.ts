import doResolve from 'resolve';

import { replaceExtension } from './utils.js';

export function resolve(
  id: string,
  opts: {
    basedir: string;
    extensions: string[];
  }
) {
  const res = doResolve.sync(id, {
    basedir: opts.basedir,
    extensions: opts.extensions.map((e) => (e.startsWith('.') ? e : `.${e}`)),
  });

  if (res) {
    return replaceExtension(res, '.js');
  }

  throw new Error(`Cannot find the source file associate with ${id}.`);
}
