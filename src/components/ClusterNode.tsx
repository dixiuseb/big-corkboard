"use client";

import { Handle, Position, useReactFlow } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import { type NoteColorKey, NOTE_COLOR_META, DEFAULT_NOTE_COLOR } from "@/lib/noteColors";
import type { NoteFormatting } from "@/components/NoteCard";

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
};

export type ClusterFlowNode = Node<ClusterNodeData, "clusterNode">;

// Fixed rotation/translate for each back-card layer (index 0 = furthest back).
const BACK_CARD_TRANSFORMS = [
  "rotate(-3deg) translate(5px, -2px)",
  "rotate(2.5deg) translate(-4px, -1px)",
];

function ClusterNode({ id, data, selected }: NodeProps<ClusterFlowNode>) {
  const { updateNodeData } = useReactFlow();
  const colorKey = data.colorKey ?? DEFAULT_NOTE_COLOR;
  const palette = NOTE_COLOR_META[colorKey];
  const notes = data.notes ?? [];
  // Cap the visible stack at 3 layers.
  const stackLayers = Math.min(notes.length, 3);
  const frontNote = notes[0];

  const openPanel = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateNodeData(id, { expanded: true });
  };

  // Peek height: extra top space so back cards are visible above the front card.
  const peekPadding = stackLayers > 1 ? 12 : 0;

  return (
    <>
      {/* 8 handles: 4 sides + 4 corners */}
      <Handle id="t"  type="source" position={Position.Top}                                              style={{ backgroundColor: palette.handleColor, borderColor: palette.handleColor }} className="!h-2 !w-2 !rounded-full !border" />
      <Handle id="b"  type="source" position={Position.Bottom}                                           style={{ backgroundColor: palette.handleColor, borderColor: palette.handleColor }} className="!h-2 !w-2 !rounded-full !border" />
      <Handle id="l"  type="source" position={Position.Left}                                             style={{ backgroundColor: palette.handleColor, borderColor: palette.handleColor }} className="!h-2 !w-2 !rounded-full !border" />
      <Handle id="r"  type="source" position={Position.Right}                                            style={{ backgroundColor: palette.handleColor, borderColor: palette.handleColor }} className="!h-2 !w-2 !rounded-full !border" />
      <Handle id="tl" type="source" position={Position.Top}    style={{ left: 0,      backgroundColor: palette.handleColor, borderColor: palette.handleColor }} className="!h-2 !w-2 !rounded-full !border" />
      <Handle id="tr" type="source" position={Position.Top}    style={{ left: "100%", backgroundColor: palette.handleColor, borderColor: palette.handleColor }} className="!h-2 !w-2 !rounded-full !border" />
      <Handle id="bl" type="source" position={Position.Bottom} style={{ left: 0,      backgroundColor: palette.handleColor, borderColor: palette.handleColor }} className="!h-2 !w-2 !rounded-full !border" />
      <Handle id="br" type="source" position={Position.Bottom} style={{ left: "100%", backgroundColor: palette.handleColor, borderColor: palette.handleColor }} className="!h-2 !w-2 !rounded-full !border" />

      <div
        className="relative"
        style={{ width: 240, paddingTop: peekPadding }}
      >
        {/* Back cards — one per stack layer behind the front */}
        {Array.from({ length: stackLayers - 1 }).map((_, i) => (
          <div
            key={i}
            // Render from furthest-back (index 0) to closest-to-front.
            style={{
              position: "absolute",
              inset: 0,
              transform: BACK_CARD_TRANSFORMS[i],
              zIndex: i,
            }}
            className={`rounded-lg border ${palette.cardClass}`}
          />
        ))}

        {/* Front card */}
        <div
          className={`relative rounded-lg border shadow-md ring-2 ring-offset-1 transition-shadow ${palette.cardClass} ${selected ? `${palette.selectedRing} shadow-lg` : "ring-transparent"}`}
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
        </div>
      </div>

    </>
  );
}

export default ClusterNode;
