/** Default and clamp bounds for canvas note cards (px in flow space). */
export const DEFAULT_NOTE_WIDTH = 240;
export const DEFAULT_NOTE_HEIGHT = 120;
export const MIN_NOTE_WIDTH = 120;
export const MAX_NOTE_WIDTH = 560;
export const MIN_NOTE_HEIGHT = 80;
export const MAX_NOTE_HEIGHT = 480;

export type NoteDimensions = {
  width?: number;
  height?: number;
};

export function clampNoteWidth(width: number): number {
  return Math.round(Math.min(MAX_NOTE_WIDTH, Math.max(MIN_NOTE_WIDTH, width)));
}

export function clampNoteHeight(height: number): number {
  return Math.round(Math.min(MAX_NOTE_HEIGHT, Math.max(MIN_NOTE_HEIGHT, height)));
}

export function resolveNoteWidth(data: NoteDimensions | undefined): number {
  const w = data?.width;
  if (typeof w === "number" && Number.isFinite(w)) return clampNoteWidth(w);
  return DEFAULT_NOTE_WIDTH;
}

export function resolveNoteHeight(data: NoteDimensions | undefined): number {
  const h = data?.height;
  if (typeof h === "number" && Number.isFinite(h)) return clampNoteHeight(h);
  return DEFAULT_NOTE_HEIGHT;
}
