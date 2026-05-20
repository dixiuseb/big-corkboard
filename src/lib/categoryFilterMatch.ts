import type { NoteColorKey } from "@/lib/noteColors";
import { DEFAULT_NOTE_COLOR } from "@/lib/noteColors";
import type { ClusterMember } from "@/lib/clusterMembers";
import { clusterMembersMatchFilter } from "@/lib/clusterMembers";

/** True when this note color counts as the active category filter. */
export function noteColorMatchesFilter(
  colorKey: NoteColorKey | undefined,
  filter: NoteColorKey,
): boolean {
  return (colorKey ?? DEFAULT_NOTE_COLOR) === filter;
}

/**
 * Cluster matches the filter if **any** contained note matches (any depth),
 * or the cluster is empty and its fallback `colorKey` matches.
 */
export function clusterNotesMatchFilter(
  notes: ClusterMember[] | undefined,
  clusterColorKey: NoteColorKey | undefined,
  filter: NoteColorKey,
): boolean {
  return clusterMembersMatchFilter(notes, clusterColorKey, filter);
}
