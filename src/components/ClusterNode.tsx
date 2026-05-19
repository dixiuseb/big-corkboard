"use client";

import { useRef, useState } from "react";
import { Handle, Position, useReactFlow, useUpdateNodeInternals } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import { type NoteColorKey, NOTE_COLOR_META, DEFAULT_NOTE_COLOR } from "@/lib/noteColors";
import { useCategoryFilter } from "@/lib/CategoryFilterContext";
import {
  clusterMembersMatchFilter,
  type ClusterMember,
  countLeafNotes,
  firstLeafNote,
  leafPrefixInMemberOrder,
  updateLeafNoteInMembers,
} from "@/lib/clusterMembers";
import { useSearchSession } from "@/lib/SearchContext";
import { useLayoutEffect } from "react";
import { FONT_SIZE_CLASSES, type NoteFontSize } from "@/components/NoteCard";
import {
  clampNoteHeight,
  clampNoteWidth,
  CLUSTER_HEADER_HEIGHT,
  clusterPeekPadding,
  resolveNoteHeight,
  resolveNoteWidth,
} from "@/lib/noteDimensions";
import { useUndoContext } from "@/lib/UndoContext";

export type { ClusterMember, ClusterNestedMember, ClusterNoteItem } from "@/lib/clusterMembers";

export type ClusterNodeData = {
  notes: ClusterMember[];
  colorKey?: NoteColorKey;
  expanded?: boolean;
  isDropTarget?: boolean;
};

export type ClusterFlowNode = Node<ClusterNodeData, "clusterNode">;

// Fixed rotation/translate for each back-card layer (index 0 = furthest back).
const BACK_CARD_TRANSFORMS = [
  "rotate(-3deg) translate(5px, -2px)",
  "rotate(2.5deg) translate(-4px, -1px)",
];

function ClusterNode({ id, data, selected }: NodeProps<ClusterFlowNode>) {
  const { setNodes, updateNodeData, getZoom } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const { pushSnapshot } = useUndoContext();
  const categoryFilter = useCategoryFilter();
  const search = useSearchSession();
  const resizeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    frontNoteId: string;
  } | null>(null);
  /** Live dimensions while dragging — avoids persisting on every pointermove. */
  const [resizeLive, setResizeLive] = useState<{ w: number; h: number } | null>(null);

  const notes = data.notes ?? [];
  const leafCount = countLeafNotes(notes);
  const stackLayers = Math.min(leafCount, 3);
  const stackNotes = leafPrefixInMemberOrder(notes, stackLayers);
  const frontNote = firstLeafNote(notes);
  const frontFmt = frontNote?.formatting ?? {};
  const frontFontSize: NoteFontSize = frontFmt.fontSize ?? "md";
  const frontPreviewClasses = [
    FONT_SIZE_CLASSES[frontFontSize],
    frontFmt.bold ? "font-bold" : "",
    frontFmt.italic ? "italic" : "",
    frontFmt.underline ? "underline" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const cardWidth = resizeLive?.w ?? resolveNoteWidth(frontNote);
  const cardHeight = resizeLive?.h ?? resolveNoteHeight(frontNote);
  const peekPadding = clusterPeekPadding(leafCount);
  // Front card + handles follow the top note; fall back to cluster colorKey for older data.
  const frontColorKey = frontNote?.colorKey ?? data.colorKey ?? DEFAULT_NOTE_COLOR;
  const frontPalette = NOTE_COLOR_META[frontColorKey];
  const isDropTarget = !!data.isDropTarget;
  const filterDimmed =
    categoryFilter !== null &&
    !clusterMembersMatchFilter(notes, data.colorKey, categoryFilter);
  const searchDimmed =
    search.dimNonMatches && !search.clusterHasPassiveOrActiveMatch(id);
  const outerDimmed = filterDimmed || searchDimmed;

  const activeMatch =
    search.matches.length > 0 ? search.matches[search.activeIndex] : undefined;
  const activeClusterSearch =
    search.dimNonMatches &&
    activeMatch?.kind === "cluster" &&
    activeMatch.clusterId === id;
  const passiveClusterSearch =
    search.dimNonMatches &&
    search.clusterHasPassiveOrActiveMatch(id) &&
    !activeClusterSearch;

  let frontRing = "ring-transparent";
  if (isDropTarget) frontRing = `${frontPalette.selectedRing} shadow-lg scale-[1.03]`;
  else if (activeClusterSearch) frontRing = `${frontPalette.selectedRing} z-[1] shadow-lg scale-[1.02]`;
  else if (selected) frontRing = `${frontPalette.selectedRing} shadow-lg`;
  else if (passiveClusterSearch) frontRing = `${frontPalette.selectedRing}`;

  const openPanel = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Close any other open cluster panel before expanding this one.
    setNodes((nds: Node[]) =>
      nds.map((n) => {
        if (n.type !== "clusterNode") return n;
        const expanded = n.id === id ? true : false;
        return n.data.expanded === expanded ? n : { ...n, data: { ...n.data, expanded } };
      }),
    );
  };

  // React Flow caches handle positions on the node and only recomputes them when width/height
  // change. Our handles sit on the inner front card, so we must force a remeasure when layout
  // can shift without changing the outer node's offset dimensions (e.g. stack peek, preview text).
  useLayoutEffect(() => {
    updateNodeInternals(id);
  }, [
    id,
    updateNodeInternals,
    notes.length,
    leafCount,
    peekPadding,
    stackLayers,
    frontNote?.id,
    frontNote?.body,
    frontNote?.width,
    frontNote?.height,
    frontPreviewClasses,
    selected,
    isDropTarget,
  ]);

  const onResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!frontNote) return;
    e.stopPropagation();
    e.preventDefault();
    pushSnapshot();
    resizeRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startW: cardWidth,
      startH: cardHeight,
      frontNoteId: frontNote.id,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = resizeRef.current;
    if (!r || e.pointerId !== r.pointerId) return;
    const zoom = getZoom();
    const dw = (e.clientX - r.startX) / zoom;
    const dh = (e.clientY - r.startY) / zoom;
    setResizeLive({
      w: clampNoteWidth(r.startW + dw),
      h: clampNoteHeight(r.startH + dh),
    });
  };

  const onResizePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = resizeRef.current;
    if (!r || e.pointerId !== r.pointerId) return;
    const nextW = clampNoteWidth(r.startW + (e.clientX - r.startX) / getZoom());
    const nextH = clampNoteHeight(r.startH + (e.clientY - r.startY) / getZoom());
    resizeRef.current = null;
    setResizeLive(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    updateNodeData(id, {
      notes: updateLeafNoteInMembers(notes, r.frontNoteId, {
        width: nextW,
        height: nextH,
      }),
    });
    updateNodeInternals(id);
  };

  return (
    <>
      <div
        className={`relative transition-opacity ${outerDimmed ? "opacity-[0.38]" : ""}`}
        style={{ width: cardWidth, paddingTop: peekPadding }}
      >
        {/* Back cards — one per stack layer behind the front; each uses that note's color. */}
        {Array.from({ length: stackLayers - 1 }).map((_, i) => {
          // i = 0 is furthest back → last visible note in the capped stack (e.g. notes[2] when 3+ notes).
          const noteIndex = stackLayers - 1 - i;
          const backNote = stackNotes[noteIndex];
          const backKey = backNote?.colorKey ?? DEFAULT_NOTE_COLOR;
          const backPalette = NOTE_COLOR_META[backKey];
          return (
            <div
              key={`${backNote?.id ?? noteIndex}-${i}`}
              style={{
                position: "absolute",
                inset: 0,
                transform: BACK_CARD_TRANSFORMS[i],
                zIndex: i,
              }}
              className={`rounded-lg ${backPalette.cardClass}`}
            />
          );
        })}

        {/* Front card */}
        <div
          className={`relative flex flex-col overflow-hidden rounded-lg border shadow-md ${activeClusterSearch ? "ring-4" : "ring-2"} ring-offset-2 ring-offset-white transition-[opacity,transform,box-shadow] dark:ring-offset-neutral-900 ${frontPalette.cardClass} ${frontRing}`}
          style={{ zIndex: stackLayers, height: CLUSTER_HEADER_HEIGHT + cardHeight }}
        >
          {/* Header row: note count + expand button */}
          <div className="flex shrink-0 items-center justify-between px-3 pt-2">
            {stackNotes.length === 0 ? (
              <span className="text-xs font-medium opacity-50">0 notes</span>
            ) : (
              <span className="text-xs font-medium opacity-50">
                {leafCount} {leafCount === 1 ? "note" : "notes"}
              </span>
            )}
            <button
              type="button"
              title="Expand cluster"
              onClick={openPanel}
              className="nodrag flex h-6 w-6 items-center justify-center rounded-md opacity-40 transition-opacity hover:opacity-80"
            >
              {/* Expand icon */}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
          </div>

          {/* First note preview — dimensions match the top inner note */}
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            <p
              className={`select-none whitespace-pre-wrap break-words px-3 py-2 opacity-75 ${frontPreviewClasses}`}
            >
              {frontNote?.body || (
                <span className="opacity-40 italic">Note...</span>
              )}
            </p>
          </div>

          {selected && frontNote && (
            <div
              role="separator"
              aria-label="Resize cluster"
              title="Drag to resize (applies to top note)"
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

          {/* Handles pinned to the front card only (relative containing block); above stack layers */}
          <Handle id="t"  type="source" position={Position.Top}    className={`!z-50 !h-2 !w-2 !rounded-full !border ${frontPalette.handleClass}`} />
          <Handle id="b"  type="source" position={Position.Bottom} className={`!z-50 !h-2 !w-2 !rounded-full !border ${frontPalette.handleClass}`} />
          <Handle id="l"  type="source" position={Position.Left}  className={`!z-50 !h-2 !w-2 !rounded-full !border ${frontPalette.handleClass}`} />
          <Handle id="r"  type="source" position={Position.Right} className={`!z-50 !h-2 !w-2 !rounded-full !border ${frontPalette.handleClass}`} />
          <Handle id="tl" type="source" position={Position.Top}    style={{ left: 0 }}      className={`!z-50 !h-2 !w-2 !rounded-full !border ${frontPalette.handleClass}`} />
          <Handle id="tr" type="source" position={Position.Top}    style={{ left: "100%" }} className={`!z-50 !h-2 !w-2 !rounded-full !border ${frontPalette.handleClass}`} />
          <Handle id="bl" type="source" position={Position.Bottom} style={{ left: 0 }}      className={`!z-50 !h-2 !w-2 !rounded-full !border ${frontPalette.handleClass}`} />
          <Handle id="br" type="source" position={Position.Bottom} style={{ left: "100%" }} className={`!z-50 !h-2 !w-2 !rounded-full !border ${frontPalette.handleClass}`} />
        </div>
      </div>

    </>
  );
}

export default ClusterNode;
