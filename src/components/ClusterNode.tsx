"use client";

import { Handle, Position, useReactFlow, useUpdateNodeInternals } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import { type NoteColorKey, NOTE_COLOR_META, DEFAULT_NOTE_COLOR } from "@/lib/noteColors";
import type { NoteFormatting } from "@/components/NoteCard";
import { useCategoryFilter } from "@/lib/CategoryFilterContext";
import { clusterNotesMatchFilter } from "@/lib/categoryFilterMatch";
import { useSearchSession } from "@/lib/SearchContext";
import { useLayoutEffect } from "react";

// A note stored inside a cluster (not a canvas node).
export type ClusterNoteItem = {
  id: string;
  body: string;
  colorKey?: NoteColorKey;
  formatting?: NoteFormatting;
};

export type ClusterNodeData = {
  notes: ClusterNoteItem[];
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
  const { setNodes } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const categoryFilter = useCategoryFilter();
  const search = useSearchSession();
  const notes = data.notes ?? [];
  // Cap the visible stack at 3 layers.
  const stackLayers = Math.min(notes.length, 3);
  const frontNote = notes[0];
  // Front card + handles follow the top note; fall back to cluster colorKey for older data.
  const frontColorKey = frontNote?.colorKey ?? data.colorKey ?? DEFAULT_NOTE_COLOR;
  const frontPalette = NOTE_COLOR_META[frontColorKey];
  const isDropTarget = !!data.isDropTarget;
  const filterDimmed =
    categoryFilter !== null &&
    !clusterNotesMatchFilter(notes, data.colorKey, categoryFilter);
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

  // Peek height: extra top space so back cards are visible above the front card.
  const peekPadding = stackLayers > 1 ? 12 : 0;

  // React Flow caches handle positions on the node and only recomputes them when width/height
  // change. Our handles sit on the inner front card, so we must force a remeasure when layout
  // can shift without changing the outer node's offset dimensions (e.g. stack peek, preview text).
  useLayoutEffect(() => {
    updateNodeInternals(id);
  }, [
    id,
    updateNodeInternals,
    notes.length,
    peekPadding,
    stackLayers,
    frontNote?.body,
    selected,
    isDropTarget,
  ]);

  return (
    <>
      <div
        className={`relative transition-opacity ${outerDimmed ? "opacity-[0.38]" : ""}`}
        style={{ width: 240, paddingTop: peekPadding }}
      >
        {/* Back cards — one per stack layer behind the front; each uses that note's color. */}
        {Array.from({ length: stackLayers - 1 }).map((_, i) => {
          // i = 0 is furthest back → last visible note in the capped stack (e.g. notes[2] when 3+ notes).
          const noteIndex = stackLayers - 1 - i;
          const backNote = notes[noteIndex];
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
          className={`relative rounded-lg border shadow-md ${activeClusterSearch ? "ring-4" : "ring-2"} ring-offset-2 ring-offset-white transition-all dark:ring-offset-neutral-900 ${frontPalette.cardClass} ${frontRing}`}
          style={{ zIndex: stackLayers }}
        >
          {/* Header row: note count + expand button */}
          <div className="flex items-center justify-between px-3 pt-2">
            <span className="text-xs font-medium opacity-50">
              {notes.length} {notes.length === 1 ? "note" : "notes"}
            </span>
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

          {/* First note preview */}
          <p className="min-h-[88px] select-none whitespace-pre-wrap break-words px-3 py-2 text-sm leading-relaxed opacity-75">
            {frontNote?.body || (
              <span className="opacity-40 italic">Note...</span>
            )}
          </p>

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
