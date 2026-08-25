export type DirectedEdge = Readonly<{ from: string; to: string }>;

/** Returns true when the directed graph contains a self-reference or a cycle. */
export function hasDirectedCycle(nodes: readonly string[], edges: readonly DirectedEdge[]) {
  const known = new Set(nodes);
  const graph = new Map(nodes.map((node) => [node, [] as string[]]));
  for (const edge of edges) {
    if (!known.has(edge.from) || !known.has(edge.to) || edge.from === edge.to) return true;
    graph.get(edge.from)!.push(edge.to);
  }
  const state = new Map<string, 0 | 1 | 2>();
  const visit = (node: string): boolean => {
    if (state.get(node) === 1) return true;
    if (state.get(node) === 2) return false;
    state.set(node, 1);
    for (const next of graph.get(node) || []) if (visit(next)) return true;
    state.set(node, 2);
    return false;
  };
  return nodes.some(visit);
}
