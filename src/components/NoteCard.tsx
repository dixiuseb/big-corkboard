"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Handle, Position, useReactFlow, useUpdateNodeInternals } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import {
  type NoteColorKey,
  NOTE_COLOR_META,
  DEFAULT_NOTE_COLOR,
  parseHandleFillColors,
} from "@/lib/noteColors";
import {
  clampNoteHeight,
  clampNoteWidth,
  resolveNoteHeight,
  resolveNoteWidth,
} from "@/lib/noteDimensions";
import { useCategoryFilter } from "@/lib/CategoryFilterContext";
import { noteColorMatchesFilter } from "@/lib/categoryFilterMatch";
import { useSearchSession } from "@/lib/SearchContext";
import { useUndoContext } from "@/lib/UndoContext";

export type NoteFontSize = "sm" | "md" | "lg" | "xl";

export type NoteFormatting = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: NoteFontSize;
};

export type NoteNodeData = {
  body: string;
  colorKey?: NoteColorKey;
  formatting?: NoteFormatting;
  width?: number;
  height?: number;
  isDropTarget?: boolean;
};

export type NoteFlowNode = Node<NoteNodeData, "noteCard">;

export const FONT_SIZE_CLASSES: Record<NoteFontSize, string> = {
  sm: "text-xs leading-relaxed",
  md: "text-sm leading-relaxed",
  lg: "text-base leading-relaxed",
  xl: "text-lg leading-relaxed",
};

/** Per-note scrollbar rules — native bar hidden when overflow; custom rail shows instead. */
function NoteCardScrollbarStyles({ nodeId, handleClass }: { nodeId: string; handleClass: string }) {
  const { light, dark } = parseHandleFillColors(handleClass);
  const sel = `[data-note-scroll="${nodeId}"]`;
  const thumb = `[data-note-scroll-thumb="${nodeId}"]`;
  return (
    <style>{`
      ${sel}.note-card-scroll--overflow {
        overflow-y: scroll;
        scrollbar-width: none;
      }
      ${sel}.note-card-scroll--overflow::-webkit-scrollbar {
        display: none;
      }
      ${thumb} {
        background-color: ${light};
      }
      @media (prefers-color-scheme: dark) {
        ${thumb} {
          background-color: ${dark};
        }
      }
    `}</style>
  );
}

function NoteCard({ id, data, selected }: NodeProps<NoteFlowNode>) {
  const { updateNodeData, getZoom } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const { pushSnapshot } = useUndoContext();
  const categoryFilter = useCategoryFilter();
  const search = useSearchSession();
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTrackRef = useRef<HTMLDivElement>(null);
  const [scrollThumb, setScrollThumb] = useState<{ heightPct: number; topPct: number } | null>(null);
  const scrollThumbDragRef = useRef<{
    pointerId: number;
    startY: number;
    startScrollTop: number;
  } | null>(null);
  const resizeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);

  const colorKey = data.colorKey ?? DEFAULT_NOTE_COLOR;
  const palette = NOTE_COLOR_META[colorKey];
  const fmt = data.formatting ?? {};
  const fontSize: NoteFontSize = fmt.fontSize ?? "md";
  const isDropTarget = !!data.isDropTarget;
  const cardWidth = resolveNoteWidth(data);
  const cardHeight = resolveNoteHeight(data);
  const filterDimmed =
    categoryFilter !== null && !noteColorMatchesFilter(data.colorKey, categoryFilter);
  const searchDimmed =
    search.dimNonMatches &&
    !search.isPassiveCanvasMatch(id) &&
    !search.isActiveCanvasMatch(id);
  const dimmed = filterDimmed || searchDimmed;

  const passiveSearch = search.isPassiveCanvasMatch(id);
  const activeSearch = search.isActiveCanvasMatch(id);

  let ringShell = "ring-transparent";
  if (isDropTarget) ringShell = `${palette.selectedRing} shadow-lg scale-[1.03]`;
  else if (activeSearch) ringShell = `${palette.selectedRing} z-[1] shadow-lg scale-[1.02]`;
  else if (selected) ringShell = `${palette.selectedRing} shadow-lg`;
  else if (passiveSearch) ringShell = `${palette.selectedRing}`;

  const enterEditMode = () => {
    pushSnapshot();
    setEditing(true);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const exitEditMode = () => setEditing(false);

  const fmtClasses = [
    FONT_SIZE_CLASSES[fontSize],
    fmt.bold ? "font-bold" : "",
    fmt.italic ? "italic" : "",
    fmt.underline ? "underline" : "",
  ]
    .filter(Boolean)
    .join(" ");

  /** Keep textarea at content height; the outer div scrolls (Safari ignores scrollbar CSS on textarea). */
  const syncTextareaHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    ta.style.height = `${ta.scrollHeight}px`;
  }, []);

  const refreshScrollThumb = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollHeight, clientHeight, scrollTop } = el;
    if (scrollHeight <= clientHeight + 1) {
      setScrollThumb(null);
      return;
    }
    const heightPct = (clientHeight / scrollHeight) * 100;
    const maxTop = 100 - heightPct;
    const topPct = maxTop > 0 ? (scrollTop / (scrollHeight - clientHeight)) * maxTop : 0;
    setScrollThumb({ heightPct, topPct });
  }, []);

  useLayoutEffect(() => {
    if (editing) syncTextareaHeight();
    refreshScrollThumb();
  }, [editing, data.body, syncTextareaHeight, refreshScrollThumb, cardWidth, fmtClasses]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(refreshScrollThumb);
    ro.observe(el);
    el.addEventListener("scroll", refreshScrollThumb, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", refreshScrollThumb);
    };
  }, [refreshScrollThumb, editing]);

  const onScrollAreaWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const el = scrollRef.current;
    if (!el || el.scrollHeight <= el.clientHeight + 1) return;
    el.scrollTop += e.deltaY;
  };

  const scrollByTrackPointer = useCallback(
    (clientY: number, startScrollTop: number, startClientY: number) => {
      const el = scrollRef.current;
      const track = scrollTrackRef.current;
      if (!el || !track || !scrollThumb) return;
      const trackHeight = track.clientHeight;
      const thumbTravel = trackHeight * (1 - scrollThumb.heightPct / 100);
      const maxScroll = el.scrollHeight - el.clientHeight;
      if (maxScroll <= 0 || thumbTravel <= 0) return;
      const dy = clientY - startClientY;
      el.scrollTop = Math.min(maxScroll, Math.max(0, startScrollTop + (dy / thumbTravel) * maxScroll));
    },
    [scrollThumb],
  );

  const onScrollTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const el = scrollRef.current;
    const track = scrollTrackRef.current;
    if (!el || !track || !scrollThumb) return;

    const trackRect = track.getBoundingClientRect();
    const yInTrack = e.clientY - trackRect.top;
    const thumbHeightPx = (scrollThumb.heightPct / 100) * trackRect.height;
    const thumbTopPx = (scrollThumb.topPct / 100) * trackRect.height;
    const maxScroll = el.scrollHeight - el.clientHeight;

    if (yInTrack < thumbTopPx || yInTrack > thumbTopPx + thumbHeightPx) {
      const scrollRatio = (yInTrack - thumbHeightPx / 2) / Math.max(1, trackRect.height - thumbHeightPx);
      el.scrollTop = Math.min(maxScroll, Math.max(0, scrollRatio * maxScroll));
    }

    scrollThumbDragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startScrollTop: el.scrollTop,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onScrollTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = scrollThumbDragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    scrollByTrackPointer(e.clientY, drag.startScrollTop, drag.startY);
  };

  const onScrollTrackPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = scrollThumbDragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    scrollThumbDragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const scrollAreaClass = `note-card-scroll min-h-0 flex-1 overflow-x-hidden ${
    scrollThumb ? "note-card-scroll--overflow" : "overflow-y-hidden"
  }`;

  useLayoutEffect(() => {
    updateNodeInternals(id);
  }, [id, updateNodeInternals, cardWidth, cardHeight, data.body, editing, selected, isDropTarget]);

  const onResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    pushSnapshot();
    resizeRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startW: cardWidth,
      startH: cardHeight,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = resizeRef.current;
    if (!r || e.pointerId !== r.pointerId) return;
    const zoom = getZoom();
    const dw = (e.clientX - r.startX) / zoom;
    const dh = (e.clientY - r.startY) / zoom;
    updateNodeData(id, {
      width: clampNoteWidth(r.startW + dw),
      height: clampNoteHeight(r.startH + dh),
    });
  };

  const onResizePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = resizeRef.current;
    if (!r || e.pointerId !== r.pointerId) return;
    resizeRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    updateNodeInternals(id);
  };

  return (
    <>
      <NoteCardScrollbarStyles nodeId={id} handleClass={palette.handleClass} />
      {/* 8 handles: 4 sides + 4 corners */}
      <Handle id="t"  type="source" position={Position.Top}                                              className={`!h-2 !w-2 !rounded-full !border ${palette.handleClass}`} />
      <Handle id="b"  type="source" position={Position.Bottom}                                           className={`!h-2 !w-2 !rounded-full !border ${palette.handleClass}`} />
      <Handle id="l"  type="source" position={Position.Left}                                             className={`!h-2 !w-2 !rounded-full !border ${palette.handleClass}`} />
      <Handle id="r"  type="source" position={Position.Right}                                            className={`!h-2 !w-2 !rounded-full !border ${palette.handleClass}`} />
      <Handle id="tl" type="source" position={Position.Top}    style={{ left: 0 }}      className={`!h-2 !w-2 !rounded-full !border ${palette.handleClass}`} />
      <Handle id="tr" type="source" position={Position.Top}    style={{ left: "100%" }} className={`!h-2 !w-2 !rounded-full !border ${palette.handleClass}`} />
      <Handle id="bl" type="source" position={Position.Bottom} style={{ left: 0 }}      className={`!h-2 !w-2 !rounded-full !border ${palette.handleClass}`} />
      <Handle id="br" type="source" position={Position.Bottom} style={{ left: "100%" }} className={`!h-2 !w-2 !rounded-full !border ${palette.handleClass}`} />

      <div
        onDoubleClick={!editing ? enterEditMode : undefined}
        style={{ width: cardWidth, height: cardHeight }}
        className={`relative flex cursor-grab flex-col overflow-hidden rounded-lg border shadow-md outline-none ${activeSearch ? "ring-4" : "ring-2"} ring-offset-2 ring-offset-white transition-[opacity,transform,box-shadow] active:cursor-grabbing dark:ring-offset-neutral-900 ${palette.cardClass} ${ringShell} ${editing ? "cursor-default active:cursor-default" : ""} ${dimmed ? "opacity-[0.38]" : ""}`}
      >
        {editing ? (
          <div
            ref={scrollRef}
            data-note-scroll={id}
            onWheel={onScrollAreaWheel}
            className={scrollAreaClass}
          >
            <textarea
              ref={textareaRef}
              value={data.body}
              onChange={(e) => {
                updateNodeData(id, { body: e.target.value });
                syncTextareaHeight();
                requestAnimationFrame(refreshScrollThumb);
              }}
              onBlur={exitEditMode}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  exitEditMode();
                }
              }}
              placeholder="Note…"
              rows={1}
              className={`nodrag nopan block w-full cursor-text resize-none overflow-hidden bg-transparent px-3 py-2 pr-4 outline-none placeholder:text-current/45 ${fmtClasses}`}
              spellCheck
            />
          </div>
        ) : (
          <div
            ref={scrollRef}
            data-note-scroll={id}
            onWheel={onScrollAreaWheel}
            className={scrollAreaClass}
          >
            <p
              className={`w-full select-none whitespace-pre-wrap break-words px-3 py-2 pr-4 opacity-100 empty:after:text-current/45 empty:after:content-['Note…'] ${fmtClasses}`}
            >
              {data.body}
            </p>
          </div>
        )}

        {scrollThumb && (
          <div
            ref={scrollTrackRef}
            role="scrollbar"
            aria-orientation="vertical"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(scrollThumb.topPct)}
            className="nodrag nopan absolute bottom-2 right-0 top-2 z-10 w-3 cursor-grab touch-none active:cursor-grabbing"
            onPointerDown={onScrollTrackPointerDown}
            onPointerMove={onScrollTrackPointerMove}
            onPointerUp={onScrollTrackPointerEnd}
            onPointerCancel={onScrollTrackPointerEnd}
          >
            <div
              data-note-scroll-thumb={id}
              className="pointer-events-none absolute right-1 w-1 rounded-full opacity-80"
              style={{
                height: `${scrollThumb.heightPct}%`,
                top: `${scrollThumb.topPct}%`,
              }}
            />
          </div>
        )}

        {selected && !editing && (
          <div
            role="separator"
            aria-label="Resize note"
            title="Drag to resize"
            className="nodrag nopan absolute bottom-0 right-0 z-10 flex h-5 w-5 cursor-se-resize items-end justify-end rounded-br-lg pb-0.5 pr-0.5 text-current/45 opacity-70 transition-opacity hover:text-current/70 hover:opacity-100"
            onPointerDown={onResizePointerDown}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerEnd}
            onPointerCancel={onResizePointerEnd}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden>
              <circle cx="8.5" cy="8.5" r="1" />
              <circle cx="5.5" cy="8.5" r="1" />
              <circle cx="8.5" cy="5.5" r="1" />
            </svg>
          </div>
        )}
      </div>
    </>
  );
}

export default NoteCard;
