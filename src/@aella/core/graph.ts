import fs from 'fs';
import type { Json } from './types';

export interface Node<T, K, E = undefined> {
  readonly key: K;
  readonly data: T;

  readonly edgesFrom: ReadonlyArray<Edge<T, K, E>>;
  readonly edgesTo: ReadonlyArray<Edge<T, K, E>>;
}

export interface Edge<T, K, E = undefined> {
  readonly data: E;
  readonly from: {
    readonly key: K;
    readonly node: Node<T, K, E>;
  };
  readonly to: {
    readonly key: K;
    readonly node: Node<T, K, E>;
  };
}

type AddEdge<T, K, E> = E extends undefined
  ? (fromKey: K, toKey: K) => Edge<T, K, E> | null
  : (fromKey: K, toKey: K, edgeData: E) => Edge<T, K, E> | null;

export interface GraphDetails<T, K, E> {
  edges: Array<{
    from: string;
    to: string;
    data: Json;
  }>;
  nodes: Record<string, Json>;
}

export interface Graph<T, K, E = undefined> {
  readonly nodes: ReadonlyArray<Node<T, K, E>>;

  add(key: K, data: T): Node<T, K, E>;
  get(key: K): Node<T, K, E> | null;
  has(key: K): boolean;
  remove(key: K): Node<T, K, E> | null;

  // returns edge if both nodes are present, or null if not
  addEdge: AddEdge<T, K, E>;
  // returns edge if both nodes are present, or null if not
  getEdge(fromKey: K, toKey: K): Edge<T, K, E> | null;
  hasEdge(fromKey: K, toKey: K): boolean;
  // returns edge if both nodes are present, or null if not
  removeEdge(fromKey: K, toKey: K): Edge<T, K, E> | null;

  getEdges(key: K): {
    readonly from: ReadonlyArray<Edge<T, K, E>>;
    readonly to: ReadonlyArray<Edge<T, K, E>>;
  };
  getEdgesFrom(key: K): ReadonlyArray<Edge<T, K, E>>;
  getEdgesTo(key: K): ReadonlyArray<Edge<T, K, E>>;

  print(file: string, nodeToStringFn?: (node: Node<T, K, E>) => string): void;
  details(fns: {
    edgeDataToJSON(edgeData: E): Json;
    keyToString(key: K): string;
    nodeDataToJSON(nodeData: T): Json;
  }): GraphDetails<T, K, E>;
}

function createNode<T, K, E = null>(key: K, data: T, graph: Graph<T, K, E>): Node<T, K, E> {
  return Object.freeze({
    key,
    data,
    get edgesFrom() {
      return graph.getEdgesFrom(key);
    },
    get edgesTo() {
      return graph.getEdgesTo(key);
    },
  });
}

export function createGraph<T, K, E = undefined>(): Graph<T, K, E> {
  const nodes = new Map<K, Node<T, K, E>>();
  const edgesTo = new Map<K, Set<K>>();
  // const edgesFrom = new Map<K, Set<K>>();
  const edgesFrom = new Map<K, Map<K, E>>();

  function get(key: K): Node<T, K, E> | null {
    return nodes.get(key) || null;
  }

  function hasEdge(fromKey: K, toKey: K): boolean {
    return Boolean(edgesFrom.get(fromKey)?.has(toKey));
  }

  function getEdge(fromKey: K, toKey: K): Edge<T, K, E> | null {
    if (hasEdge(fromKey, toKey)) {
      const fromNode = get(fromKey);
      const toNode = get(toKey);
      if (fromNode && toNode) {
        return Object.freeze({
          data: edgesFrom.get(fromKey)!.get(toKey)!,
          from: {
            key: fromKey,
            node: fromNode,
          },
          to: {
            key: toKey,
            node: toNode,
          },
        });
      }
    }
    return null;
  }

  function getEdgesFrom(key: K): ReadonlyArray<Edge<T, K, E>> {
    const toKeyMap = edgesFrom.get(key);
    if (toKeyMap && toKeyMap.size > 0) {
      return Array.from(toKeyMap.keys())
        .map((toKey) => getEdge(key, toKey))
        .filter(Boolean) as Edge<T, K, E>[];
    }
    return [];
  }

  function getEdgesTo(key: K): ReadonlyArray<Edge<T, K, E>> {
    const fromKeys = edgesTo.get(key);
    if (fromKeys && fromKeys.size > 0) {
      return Array.from(fromKeys)
        .map((fromKey) => getEdge(fromKey, key))
        .filter(Boolean) as Edge<T, K, E>[];
    }
    return [];
  }

  const graph: Graph<T, K, E> = {
    get nodes() {
      return Array.from(nodes.values());
    },

    add(key, data) {
      let node = nodes.get(key);
      if (!node) {
        node = createNode<T, K, E>(key, data, graph);
        nodes.set(key, node);
      }
      return node;
    },

    get,

    has(key) {
      return nodes.has(key);
    },

    remove(key) {
      const node = get(key);
      if (node) {
        // delete edges coming from this node
        edgesFrom.delete(key);
        // delete edges going to this node
        edgesTo.get(key)?.forEach((otherKey) => {
          edgesFrom.get(otherKey)!.delete(key);
        });
        edgesTo.delete(key);
      }
      return node;
    },

    // @ts-expect-error
    addEdge(fromKey, toKey, edgeData) {
      if (edgesFrom.has(fromKey)) {
        edgesFrom.get(fromKey)!.set(toKey, edgeData);
      } else {
        edgesFrom.set(fromKey, new Map([[toKey, edgeData]]));
      }

      if (edgesTo.has(toKey)) {
        edgesTo.get(toKey)!.add(fromKey);
      } else {
        edgesTo.set(toKey, new Set([fromKey]));
      }

      return getEdge(fromKey, toKey);
    },

    getEdge,

    hasEdge,

    removeEdge(fromKey, toKey) {
      const edge = getEdge(fromKey, toKey);

      if (hasEdge(fromKey, toKey)) {
        edgesFrom.get(fromKey)!.delete(toKey);
        edgesTo.get(toKey)!.delete(fromKey);
      }

      return edge;
    },

    getEdges(key) {
      return {
        from: getEdgesFrom(key),
        to: getEdgesTo(key),
      };
    },

    getEdgesFrom,

    getEdgesTo,

    print(file, nodeToStringFn = (node) => String(node.key)) {
      const lines: string[] = [];

      for (const node of nodes.values()) {
        lines.push(`  "${nodeToStringFn(node)}";`);

        for (const edge of node.edgesFrom) {
          lines.push(`  "${nodeToStringFn(edge.from.node)}" -> "${nodeToStringFn(edge.to.node)}";`);
        }
      }

      lines.unshift('digraph {');
      lines.push('}');

      fs.writeFileSync(file, lines.join('\n'), 'utf-8');
    },

    details({ edgeDataToJSON, keyToString, nodeDataToJSON }) {
      return {
        edges: Array.from(edgesFrom.entries()).flatMap(([fromKey, toKeyMap]) =>
          Array.from(toKeyMap.entries()).map(([toKey, edgeData]) => ({
            from: keyToString(fromKey),
            to: keyToString(toKey),
            data: edgeDataToJSON(edgeData),
          }))
        ),
        nodes: Array.from(nodes.values()).reduce<Record<string, Json>>((agg, node) => {
          agg[keyToString(node.key)] = nodeDataToJSON(node.data);
          return agg;
        }, {}),
      };
    },
  };

  return graph;
}
