import type { NoteFlowNode } from "@/components/NoteCard";
import type { ClusterFlowNode } from "@/components/ClusterNode";

export type BoardSearchNode = NoteFlowNode | ClusterFlowNode;

/** One searchable note: either a canvas card or a note inside a cluster. */
export type SearchMatch =
  | { kind: "canvas"; nodeId: string }
  | { kind: "cluster"; clusterId: string; noteId: string };

export function noteBodyMatchesCaseInsensitive(body: string, queryLower: string): boolean {
  if (queryLower.length === 0) return false;
  return body.toLowerCase().includes(queryLower);
}

/** Ordered list of matches (canvas notes first in node order, then cluster notes in cluster order then list order). */
export function buildSearchMatches(nodes: BoardSearchNode[], queryLower: string): SearchMatch[] {
  if (queryLower.length < 1) return [];
  const out: SearchMatch[] = [];
  for (const n of nodes) {
    if (n.type === "noteCard") {
      const note = n as NoteFlowNode;
      if (noteBodyMatchesCaseInsensitive(note.data.body ?? "", queryLower)) {
        out.push({ kind: "canvas", nodeId: note.id });
      }
    } else if (n.type === "clusterNode") {
      const c = n as ClusterFlowNode;
      for (const note of c.data.notes ?? []) {
        if (noteBodyMatchesCaseInsensitive(note.body ?? "", queryLower)) {
          out.push({ kind: "cluster", clusterId: c.id, noteId: note.id });
        }
      }
    }
  }
  return out;
}
