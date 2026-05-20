import {
  FONT_SIZE_CLASSES,
  type NoteFormatting,
  type NoteFontSize,
} from "@/components/NoteCard";
import {
  clampNoteHeight,
  DEFAULT_NOTE_HEIGHT,
  DEFAULT_NOTE_WIDTH,
  resolveNoteWidth,
  type NoteDimensions,
} from "@/lib/noteDimensions";

/** NoteCard outer `border` (1px) — inner content is card size minus this on each axis. */
const NOTE_CARD_BORDER_X = 2;
const NOTE_CARD_BORDER_Y = 2;
/** Scroll rail appears when content exceeds client area by ~1px (see NoteCard refreshScrollThumb). */
const FIT_SCROLL_SLACK = 2;

/** Measure note body height at a fixed width (matches canvas note card padding). */
export function measureNoteBodyHeight(
  body: string,
  formatting: NoteFormatting | undefined,
  width: number,
): number {
  if (typeof document === "undefined") return DEFAULT_NOTE_HEIGHT;

  const fmt = formatting ?? {};
  const fontSize: NoteFontSize = fmt.fontSize ?? "md";
  const fmtClasses = [
    FONT_SIZE_CLASSES[fontSize],
    fmt.bold ? "font-bold" : "",
    fmt.italic ? "italic" : "",
    fmt.underline ? "underline" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const el = document.createElement("p");
  el.style.position = "absolute";
  el.style.left = "-9999px";
  el.style.top = "0";
  el.style.visibility = "hidden";
  el.style.pointerEvents = "none";
  // Match in-card `<p>`: w-full inside bordered shell → inner width is card width minus borders.
  el.style.width = `${width - NOTE_CARD_BORDER_X}px`;
  el.style.boxSizing = "border-box";
  el.style.padding = "8px 16px 8px 12px"; // py-2 pr-4 px-3
  el.className = `whitespace-pre-wrap break-words ${fmtClasses}`;
  el.textContent = body;
  document.body.appendChild(el);
  const measured = el.scrollHeight;
  document.body.removeChild(el);

  // Stored card height includes borders; add slack so scrollHeight <= clientHeight + 1.
  const withChrome = measured + NOTE_CARD_BORDER_Y + FIT_SCROLL_SLACK;
  return clampNoteHeight(Math.max(DEFAULT_NOTE_HEIGHT, Math.ceil(withChrome)));
}

/**
 * Fit dimensions for a note at its current width: height grows/shrinks to content
 * (floor = default height). Empty body resets to default width and height.
 */
export function resolveNoteFitDimensions(
  body: string,
  formatting: NoteFormatting | undefined,
  current: NoteDimensions | undefined,
): { width: number; height: number } {
  if (!body.trim()) {
    return { width: DEFAULT_NOTE_WIDTH, height: DEFAULT_NOTE_HEIGHT };
  }
  const width = resolveNoteWidth(current);
  const height = measureNoteBodyHeight(body, formatting, width);
  return { width, height };
}
