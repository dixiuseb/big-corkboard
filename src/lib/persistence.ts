// localStorage persistence helpers for Big Corkboard.
// Board list and canvas state are stored under separate keys so the tab list
// can be loaded instantly without deserializing every board.

export const BOARDS_KEY = "corkboard:boards";
export const boardKey = (id: string) => `corkboard:board:${id}`;

export type BoardMeta = { id: string; title: string };

export type PersistedBoardState = {
  nodes: object[];
  edges: object[];
  viewport: { x: number; y: number; zoom: number };
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

export function loadBoardState(id: string): PersistedBoardState | null {
  try {
    const raw = localStorage.getItem(boardKey(id));
    if (!raw) return null;
    return JSON.parse(raw) as PersistedBoardState;
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
