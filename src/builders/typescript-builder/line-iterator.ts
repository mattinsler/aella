export function* lineIterator(value: string): Generator<string> {
  let idx = 0;

  while (true) {
    const nextIdx = value.indexOf('\n', idx);
    if (nextIdx === -1) {
      break;
    }
    yield value.slice(idx, nextIdx);
    idx = nextIdx + 1;
  }

  if (idx < value.length) {
    yield value.slice(idx);
  }
}
