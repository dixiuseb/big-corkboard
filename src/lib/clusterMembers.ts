import type { NoteFormatting } from "@/components/NoteCard";
import type { NoteColorKey } from "@/lib/noteColors";
import { DEFAULT_NOTE_COLOR } from "@/lib/noteColors";

/** A note stored inside a cluster (not a canvas node). */
export type ClusterNoteItem = {
  id: string;
  body: string;
  colorKey?: NoteColorKey;
  formatting?: NoteFormatting;
};

/** One level of nesting: only flat notes inside (no deeper clusters). */
export type ClusterNestedMember = {
  type: "nestedCluster";
  id: string;
  colorKey?: NoteColorKey;
  notes: ClusterNoteItem[];
};

/** Root cluster list: loose notes and/or at most one level of child clusters. */
export type ClusterMember = ClusterNoteItem | ClusterNestedMember;

export function isNestedClusterMember(m: ClusterMember): m is ClusterNestedMember {
  return (m as ClusterNestedMember).type === "nestedCluster";
}

/** Coerce persisted JSON into members (legacy boards are all plain notes). */
export function normalizeClusterMembers(raw: unknown): ClusterMember[] {
  if (!Array.isArray(raw)) return [];
  const out: ClusterMember[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (o.type === "nestedCluster" && typeof o.id === "string" && Array.isArray(o.notes)) {
      const notes: ClusterNoteItem[] = [];
      for (const n of o.notes) {
        if (!n || typeof n !== "object") continue;
        const nn = n as ClusterNoteItem;
        if (typeof nn.id === "string") notes.push({ ...nn });
      }
      out.push({
        type: "nestedCluster",
        id: o.id,
        colorKey: o.colorKey as NoteColorKey | undefined,
        notes,
      });
      continue;
    }
    const note = item as ClusterNoteItem;
    if (typeof note.id === "string") {
      out.push({ ...note });
    }
  }
  return out;
}

/** All leaf notes in visual order (root members left-to-right, nested depth-first). */
export function flattenLeafNotes(members: ClusterMember[]): ClusterNoteItem[] {
  const out: ClusterNoteItem[] = [];
  for (const m of members) {
    if (isNestedClusterMember(m)) {
      out.push(...m.notes);
    } else {
      out.push(m);
    }
  }
  return out;
}

export function countLeafNotes(members: ClusterMember[]): number {
  return flattenLeafNotes(members).length;
}

/** First leaf note in member list order. */
export function firstLeafNote(members: ClusterMember[]): ClusterNoteItem | undefined {
  return leafPrefixInMemberOrder(members, 1)[0];
}

/** First up to `max` leaf notes in member order (for stack preview). */
export function leafPrefixInMemberOrder(members: ClusterMember[], max: number): ClusterNoteItem[] {
  const out: ClusterNoteItem[] = [];
  for (const m of members) {
    if (out.length >= max) break;
    if (isNestedClusterMember(m)) {
      for (const n of m.notes) {
        if (out.length >= max) break;
        out.push(n);
      }
    } else {
      out.push(m);
    }
  }
  return out;
}

export function clusterMembersMatchFilter(
  members: ClusterMember[] | undefined,
  clusterColorKey: NoteColorKey | undefined,
  filter: NoteColorKey,
): boolean {
  const list = members ?? [];
  const flat = flattenLeafNotes(list);
  if (flat.length === 0) return (clusterColorKey ?? DEFAULT_NOTE_COLOR) === filter;
  return flat.some((n) => (n.colorKey ?? DEFAULT_NOTE_COLOR) === filter);
}

/** Find a leaf note by id anywhere in members. */
export function findLeafNote(
  members: ClusterMember[],
  noteId: string,
): ClusterNoteItem | undefined {
  for (const m of members) {
    if (isNestedClusterMember(m)) {
      const hit = m.notes.find((n) => n.id === noteId);
      if (hit) return hit;
    } else if (m.id === noteId) {
      return m;
    }
  }
  return undefined;
}

/** True if the note lives inside a nested cluster (not a top-level member). */
export function isNoteInsideNestedCluster(members: ClusterMember[], noteId: string): boolean {
  for (const m of members) {
    if (isNestedClusterMember(m) && m.notes.some((n) => n.id === noteId)) return true;
  }
  return false;
}

export function updateLeafNoteInMembers(
  members: ClusterMember[],
  noteId: string,
  update: Partial<ClusterNoteItem>,
): ClusterMember[] {
  return members.map((m) => {
    if (isNestedClusterMember(m)) {
      if (!m.notes.some((n) => n.id === noteId)) return m;
      return {
        ...m,
        notes: m.notes.map((n) => (n.id === noteId ? { ...n, ...update } : n)),
      };
    }
    if (m.id === noteId) return { ...m, ...update };
    return m;
  });
}

export function removeLeafNoteFromMembers(members: ClusterMember[], noteId: string): ClusterMember[] {
  const next: ClusterMember[] = [];
  for (const m of members) {
    if (isNestedClusterMember(m)) {
      const notes = m.notes.filter((n) => n.id !== noteId);
      if (notes.length > 0) {
        next.push({ ...m, notes });
      }
      // drop empty nested cluster
    } else if (m.id !== noteId) {
      next.push(m);
    }
  }
  return next;
}

/** Remove a nested cluster block by id. */
export function removeNestedClusterFromMembers(
  members: ClusterMember[],
  nestedId: string,
): ClusterMember[] {
  return members.filter((m) => !(isNestedClusterMember(m) && m.id === nestedId));
}

/** Reorder notes inside one nested cluster (`overIndex` is “insert before”, same as root panel). */
export function reorderNotesWithinNestedCluster(
  members: ClusterMember[],
  nestedClusterId: string,
  fromIndex: number,
  toIndex: number,
): ClusterMember[] {
  if (fromIndex === toIndex) return members;
  return members.map((m) => {
    if (!isNestedClusterMember(m) || m.id !== nestedClusterId) return m;
    const list = [...m.notes];
    if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex > list.length) return m;
    const [item] = list.splice(fromIndex, 1);
    let insertAt = toIndex;
    if (fromIndex < toIndex) insertAt = toIndex - 1;
    list.splice(insertAt, 0, item);
    return { ...m, notes: list };
  });
}

/** Where a panel leaf note lives before a move (cluster side panel only). */
export type PanelLeafSource =
  | { type: "root"; memberIndex: number }
  | { type: "nested"; nestedId: string; noteIndex: number };

export function findLeafSourceLocation(members: ClusterMember[], noteId: string): PanelLeafSource | null {
  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    if (isNestedClusterMember(m)) {
      const j = m.notes.findIndex((n) => n.id === noteId);
      if (j >= 0) return { type: "nested", nestedId: m.id, noteIndex: j };
    } else if (m.id === noteId) {
      return { type: "root", memberIndex: i };
    }
  }
  return null;
}

export type PanelLeafDropTarget =
  | { type: "root"; insertBeforeMemberIndex: number }
  | { type: "nested"; nestedId: string; insertBeforeNoteIndex: number };

function insertRootNoteAtMemberIndex(members: ClusterMember[], note: ClusterNoteItem, insertBefore: number): ClusterMember[] {
  const next = [...members];
  const clamped = Math.max(0, Math.min(insertBefore, next.length));
  next.splice(clamped, 0, { ...note });
  return next;
}

function insertNoteIntoNestedAt(
  members: ClusterMember[],
  nestedId: string,
  note: ClusterNoteItem,
  insertBeforeNoteIndex: number,
): ClusterMember[] {
  return members.map((m) => {
    if (!isNestedClusterMember(m) || m.id !== nestedId) return m;
    const list = [...m.notes];
    const clamped = Math.max(0, Math.min(insertBeforeNoteIndex, list.length));
    list.splice(clamped, 0, { ...note });
    return { ...m, notes: list };
  });
}

function mapInsertRootMemberIndex(
  oldMembers: ClusterMember[],
  without: ClusterMember[],
  insertBeforeOld: number,
  movedNoteId: string,
): number {
  if (insertBeforeOld <= 0) return 0;
  if (insertBeforeOld >= oldMembers.length) return without.length;
  const anchor = oldMembers[insertBeforeOld];
  const idx = without.findIndex((m) => (isNestedClusterMember(m) ? m.id : m.id) === (isNestedClusterMember(anchor) ? anchor.id : anchor.id));
  if (idx !== -1) return idx;
  if (!isNestedClusterMember(anchor) && anchor.id === movedNoteId) {
    return Math.min(insertBeforeOld, without.length);
  }
  return without.length;
}

function mapInsertNestedNoteIndex(
  without: ClusterMember[],
  nestedId: string,
  insertBeforeOld: number,
  src: PanelLeafSource,
): number {
  const block = without.find((m) => isNestedClusterMember(m) && m.id === nestedId) as ClusterNestedMember | undefined;
  if (!block) return 0;
  let j = insertBeforeOld;
  if (src.type === "nested" && src.nestedId === nestedId && src.noteIndex < j) {
    j -= 1;
  }
  return Math.max(0, Math.min(j, block.notes.length));
}

function isNoOpPanelMove(src: PanelLeafSource, dest: PanelLeafDropTarget): boolean {
  if (dest.type === "root" && src.type === "root") {
    return dest.insertBeforeMemberIndex === src.memberIndex;
  }
  if (dest.type === "nested" && src.type === "nested" && dest.nestedId === src.nestedId) {
    return dest.insertBeforeNoteIndex === src.noteIndex;
  }
  return false;
}

/**
 * Move one leaf note to a new slot in the cluster panel (root list or inside a nested block).
 * `insertBefore*` indices are from the panel UI (“insert before” line); 0..length allows append.
 */
export function movePanelLeafNote(
  members: ClusterMember[],
  noteId: string,
  dest: PanelLeafDropTarget,
): ClusterMember[] {
  const note = findLeafNote(members, noteId);
  if (!note) return members;
  const src = findLeafSourceLocation(members, noteId);
  if (!src) return members;
  if (isNoOpPanelMove(src, dest)) return members;

  if (dest.type === "nested") {
    const hasDest = members.some((m) => isNestedClusterMember(m) && m.id === dest.nestedId);
    if (!hasDest) return members;
  }

  const without = removeLeafNoteFromMembers(members, noteId);

  if (dest.type === "nested") {
    const insertJ = mapInsertNestedNoteIndex(without, dest.nestedId, dest.insertBeforeNoteIndex, src);
    return insertNoteIntoNestedAt(without, dest.nestedId, note, insertJ);
  }

  const insertI = mapInsertRootMemberIndex(members, without, dest.insertBeforeMemberIndex, noteId);
  return insertRootNoteAtMemberIndex(without, note, insertI);
}

/** Append flattened notes from a removed cluster canvas node (its members) to the end. */
export function appendFlattenedClusterMembers(
  target: ClusterMember[],
  sourceMembers: ClusterMember[],
): ClusterMember[] {
  const appended = flattenLeafNotes(sourceMembers).map((n) => ({
    ...n,
    id: crypto.randomUUID(),
  }));
  return [...target, ...appended];
}

/** Turn a canvas cluster’s contents into one nested block (leaf notes only, new ids). */
export function clusterCanvasToNestedMember(
  dataNotes: unknown,
  fallbackColorKey?: NoteColorKey,
): ClusterNestedMember {
  const members = normalizeClusterMembers(dataNotes);
  const leaves = flattenLeafNotes(members);
  return {
    type: "nestedCluster",
    id: crypto.randomUUID(),
    colorKey: fallbackColorKey,
    notes: leaves.map((n) => ({ ...n, id: crypto.randomUUID() })),
  };
}

/** Append one nested cluster (child notes only) to the end. */
export function appendNestedCluster(
  target: ClusterMember[],
  nested: ClusterNestedMember,
): ClusterMember[] {
  return [...target, nested];
}

/** Map every leaf note (top-level or inside one nested block). */
export function mapMembersTransformNotes(
  members: ClusterMember[],
  fn: (n: ClusterNoteItem) => ClusterNoteItem,
): ClusterMember[] {
  return members.map((m) => {
    if (isNestedClusterMember(m)) {
      return { ...m, notes: m.notes.map(fn) };
    }
    return fn(m);
  });
}
