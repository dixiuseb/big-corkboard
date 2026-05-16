// localStorage persistence helpers for Big Corkboard.
// Board list and canvas state are stored under separate keys so the tab list
// can be loaded instantly without deserializing every board.

import { normalizeNoteColorKey, type NoteColorKey } from "@/lib/noteColors";

export const BOARDS_KEY = "corkboard:boards";
export const boardKey = (id: string) => `corkboard:board:${id}`;

export type BoardMeta = { id: string; title: string };

/** User-defined category name per note color (v2 legend); omitted colors have no legend chip. */
export type BoardColorLabels = Partial<Record<NoteColorKey, string>>;

export type PersistedBoardState = {
  nodes: object[];
  edges: object[];
  viewport: { x: number; y: number; zoom: number };
  colorLabels?: BoardColorLabels;
};

// ── Board list ────────────────────────────────────────────────────────────────

export function loadBoardsMeta(): BoardMeta[] {
  try {
    const raw = localStorage.getItem(BOARDS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as BoardMeta[];
  } catch {
    return [];
  }
}

export function saveBoardsMeta(boards: BoardMeta[]): void {
  try {
    localStorage.setItem(BOARDS_KEY, JSON.stringify(boards));
  } catch {
    // Ignore quota errors silently; the board still functions in-memory.
  }
}

// ── Board state ───────────────────────────────────────────────────────────────

function migrateNodes(nodes: object[]): object[] {
  return nodes.map((n) => {
    if (!n || typeof n !== "object") return n;
    const node = n as Record<string, unknown>;
    const data = node.data;
    if (!data || typeof data !== "object") return n;
    const d = { ...(data as Record<string, unknown>) };
    if ("colorKey" in d) d.colorKey = normalizeNoteColorKey(d.colorKey);
    const rawNotes = d.notes;
    if (Array.isArray(rawNotes)) {
      d.notes = rawNotes.map((item) => {
        if (!item || typeof item !== "object") return item;
        const it = item as Record<string, unknown>;
        return { ...it, colorKey: normalizeNoteColorKey(it.colorKey) };
      });
    }
    return { ...node, data: d };
  });
}

function migrateColorLabels(raw: unknown): BoardColorLabels | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const next: BoardColorLabels = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const nk = normalizeNoteColorKey(k);
    if (typeof v === "string" && v.trim()) next[nk] = v.trim();
  }
  return next;
}

export function loadBoardState(id: string): PersistedBoardState | null {
  try {
    const raw = localStorage.getItem(boardKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedBoardState;
    return {
      ...parsed,
      nodes: migrateNodes(parsed.nodes ?? []),
      colorLabels: migrateColorLabels(parsed.colorLabels) ?? parsed.colorLabels,
    };
  } catch {
    return null;
  }
}

export function saveBoardState(id: string, state: PersistedBoardState): void {
  try {
    localStorage.setItem(boardKey(id), JSON.stringify(state));
  } catch {
    // Ignore quota errors silently.
  }
}

export function deleteBoardState(id: string): void {
  try {
    localStorage.removeItem(boardKey(id));
  } catch {
    // Ignore errors silently.
  }
}

// ── Active board tracking ─────────────────────────────────────────────────────

const ACTIVE_BOARD_KEY = "corkboard:activeBoard";

export function loadActiveBoard(): string | null {
  try {
    return localStorage.getItem(ACTIVE_BOARD_KEY);
  } catch {
    return null;
  }
}

export function saveActiveBoard(id: string): void {
  try {
    localStorage.setItem(ACTIVE_BOARD_KEY, id);
  } catch {
    // Ignore errors silently.
  }
}
