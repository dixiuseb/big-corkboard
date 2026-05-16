import type { NoteColorKey } from "@/lib/noteColors";
import { DEFAULT_NOTE_COLOR } from "@/lib/noteColors";
import type { ClusterNoteItem } from "@/components/ClusterNode";

/** True when this note color counts as the active category filter. */
export function noteColorMatchesFilter(
  colorKey: NoteColorKey | undefined,
  filter: NoteColorKey,
): boolean {
  return (colorKey ?? DEFAULT_NOTE_COLOR) === filter;
}

/**
 * Cluster matches the filter if **any** contained note matches, or the cluster is empty
 * and its fallback `colorKey` matches (legacy / edge case).
 */
export function clusterNotesMatchFilter(
  notes: ClusterNoteItem[] | undefined,
  clusterColorKey: NoteColorKey | undefined,
  filter: NoteColorKey,
): boolean {
  const list = notes ?? [];
  if (list.length === 0) return noteColorMatchesFilter(clusterColorKey, filter);
  return list.some((n) => noteColorMatchesFilter(n.colorKey, filter));
}
