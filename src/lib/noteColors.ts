/** Canonical note/cluster color keys (persisted as `colorKey`). */
export const NOTE_COLOR_KEYS = [
  "iris",
  "sky",
  "spearmint",
  "fern",
  "marigold",
  "terracotta",
  "rose",
  "stone",
] as const;

export type NoteColorKey = (typeof NOTE_COLOR_KEYS)[number];

/**
 * Theme-aware note colors: light surfaces + dark body text in light mode;
 * deeper surfaces + light body text in dark mode. Handles / selection rings
 * use the `label` hues (see desktop color table).
 */
export const NOTE_COLOR_META: Record<
  NoteColorKey,
  {
    label: string;
    swatch: string;
    cardClass: string;
    selectedRing: string;
    handleClass: string;
  }
> = {
  iris: {
    label: "Iris",
    swatch: "bg-[#C5BFEE] dark:bg-[#534AB7]",
    cardClass:
      "bg-[#C5BFEE] dark:bg-[#534AB7] border border-[#534AB7]/35 dark:border-[#CECBF6]/40 text-[#26215C] dark:text-[#EEEDFE] shadow-black/10 dark:shadow-black/40",
    selectedRing: "ring-[#534AB7] dark:ring-[#CECBF6]",
    handleClass:
      "!bg-[#534AB7] dark:!bg-[#CECBF6] !border-[#534AB7] dark:!border-[#CECBF6]",
  },
  sky: {
    label: "Sky",
    swatch: "bg-[#88C9F0] dark:bg-[#185FA5]",
    cardClass:
      "bg-[#88C9F0] dark:bg-[#185FA5] border border-[#185FA5]/35 dark:border-[#B5D4F4]/40 text-[#042C53] dark:text-[#E6F1FB] shadow-black/10 dark:shadow-black/40",
    selectedRing: "ring-[#185FA5] dark:ring-[#B5D4F4]",
    handleClass:
      "!bg-[#185FA5] dark:!bg-[#B5D4F4] !border-[#185FA5] dark:!border-[#B5D4F4]",
  },
  spearmint: {
    label: "Spearmint",
    swatch: "bg-[#6ECBB8] dark:bg-[#0F6E56]",
    cardClass:
      "bg-[#6ECBB8] dark:bg-[#0F6E56] border border-[#0F6E56]/35 dark:border-[#9FE1CB]/40 text-[#04342C] dark:text-[#E1F5EE] shadow-black/10 dark:shadow-black/40",
    selectedRing: "ring-[#0F6E56] dark:ring-[#9FE1CB]",
    handleClass:
      "!bg-[#0F6E56] dark:!bg-[#9FE1CB] !border-[#0F6E56] dark:!border-[#9FE1CB]",
  },
  fern: {
    label: "Fern",
    swatch: "bg-[#A4CF72] dark:bg-[#3B6D11]",
    cardClass:
      "bg-[#A4CF72] dark:bg-[#3B6D11] border border-[#3B6D11]/35 dark:border-[#C0DD97]/40 text-[#173404] dark:text-[#EAF3DE] shadow-black/10 dark:shadow-black/40",
    selectedRing: "ring-[#3B6D11] dark:ring-[#C0DD97]",
    handleClass:
      "!bg-[#3B6D11] dark:!bg-[#C0DD97] !border-[#3B6D11] dark:!border-[#C0DD97]",
  },
  marigold: {
    label: "Marigold",
    swatch: "bg-[#F2C46A] dark:bg-[#B8890E]",
    cardClass:
      "bg-[#F2C46A] dark:bg-[#B8890E] border border-[#854F0B]/35 dark:border-[#FFE08A]/45 text-[#412402] dark:text-[#FFF8E6] shadow-black/10 dark:shadow-black/40",
    selectedRing: "ring-[#854F0B] dark:ring-[#FFE08A]",
    handleClass:
      "!bg-[#854F0B] dark:!bg-[#FFE08A] !border-[#854F0B] dark:!border-[#FFE08A]",
  },
  terracotta: {
    label: "Terracotta",
    swatch: "bg-[#F0907A] dark:bg-[#D45620]",
    cardClass:
      "bg-[#F0907A] dark:bg-[#D45620] border border-[#993C1D]/35 dark:border-[#FFD0B0]/45 text-[#4A1B0C] dark:text-[#FFF5F0] shadow-black/10 dark:shadow-black/40",
    selectedRing: "ring-[#993C1D] dark:ring-[#FFD0B0]",
    handleClass:
      "!bg-[#993C1D] dark:!bg-[#FFD0B0] !border-[#993C1D] dark:!border-[#FFD0B0]",
  },
  rose: {
    label: "Rose",
    swatch: "bg-[#E889AB] dark:bg-[#993556]",
    cardClass:
      "bg-[#E889AB] dark:bg-[#993556] border border-[#993556]/35 dark:border-[#F4C0D1]/40 text-[#4B1528] dark:text-[#FBEAF0] shadow-black/10 dark:shadow-black/40",
    selectedRing: "ring-[#993556] dark:ring-[#F4C0D1]",
    handleClass:
      "!bg-[#993556] dark:!bg-[#F4C0D1] !border-[#993556] dark:!border-[#F4C0D1]",
  },
  stone: {
    label: "Stone",
    swatch: "bg-[#C8C4BC] dark:bg-[#5F5E5A]",
    cardClass:
      "bg-[#C8C4BC] dark:bg-[#5F5E5A] border border-[#5F5E5A]/35 dark:border-[#D3D1C7]/40 text-[#2C2C2A] dark:text-[#F1EFE8] shadow-black/10 dark:shadow-black/40",
    selectedRing: "ring-[#5F5E5A] dark:ring-[#D3D1C7]",
    handleClass:
      "!bg-[#5F5E5A] dark:!bg-[#D3D1C7] !border-[#5F5E5A] dark:!border-[#D3D1C7]",
  },
};

export const DEFAULT_NOTE_COLOR: NoteColorKey = "iris";

/** Light/dark handle fill hex parsed from a note `handleClass` (for scrollbar styling). */
export function parseHandleFillColors(handleClass: string): { light: string; dark: string } {
  const light = handleClass.match(/!bg-\[(#[^\]]+)\]/i)?.[1];
  const dark = handleClass.match(/dark:!bg-\[(#[^\]]+)\]/i)?.[1];
  return { light: light ?? "#64748b", dark: dark ?? light ?? "#94a3b8" };
}

/** v1 six-color keys → current palette (localStorage migration). */
export const LEGACY_NOTE_COLOR_KEY_MAP: Record<string, NoteColorKey> = {
  amber: "marigold",
  teal: "spearmint",
  violet: "iris",
  lime: "fern",
  sky: "sky",
  rose: "rose",
};

function isNoteColorKey(s: string): s is NoteColorKey {
  return (NOTE_COLOR_KEYS as readonly string[]).includes(s);
}

/** Maps persisted `colorKey` strings onto the current palette (including legacy keys). */
export function normalizeNoteColorKey(key: unknown): NoteColorKey {
  if (key == null || typeof key !== "string") return DEFAULT_NOTE_COLOR;
  if (isNoteColorKey(key)) return key;
  return LEGACY_NOTE_COLOR_KEY_MAP[key] ?? DEFAULT_NOTE_COLOR;
}
