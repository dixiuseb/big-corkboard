"use client";

import { useRef, useState } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import {
  type NoteColorKey,
  NOTE_COLOR_META,
  DEFAULT_NOTE_COLOR,
} from "@/lib/noteColors";
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
  isDropTarget?: boolean;
};

export type NoteFlowNode = Node<NoteNodeData, "noteCard">;

export const FONT_SIZE_CLASSES: Record<NoteFontSize, string> = {
  sm: "text-xs leading-relaxed",
  md: "text-sm leading-relaxed",
  lg: "text-base leading-relaxed",
  xl: "text-lg leading-relaxed",
};

function NoteCard({ id, data, selected }: NodeProps<NoteFlowNode>) {
  const { updateNodeData } = useReactFlow();
  const { pushSnapshot } = useUndoContext();
  const categoryFilter = useCategoryFilter();
  const search = useSearchSession();
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const colorKey = data.colorKey ?? DEFAULT_NOTE_COLOR;
  const palette = NOTE_COLOR_META[colorKey];
  const fmt = data.formatting ?? {};
  const fontSize: NoteFontSize = fmt.fontSize ?? "md";
  const isDropTarget = !!data.isDropTarget;
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

  return (
    <>
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
        className={`flex w-[240px] cursor-grab flex-col rounded-lg border shadow-md outline-none ${activeSearch ? "ring-4" : "ring-2"} ring-offset-2 ring-offset-white transition-[opacity,transform,box-shadow] active:cursor-grabbing dark:ring-offset-neutral-900 ${palette.cardClass} ${ringShell} ${editing ? "cursor-default active:cursor-default" : ""} ${dimmed ? "opacity-[0.38]" : ""}`}
      >
        {editing ? (
          <textarea
            ref={textareaRef}
            value={data.body}
            onChange={(e) => updateNodeData(id, { body: e.target.value })}
            onBlur={exitEditMode}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                exitEditMode();
              }
            }}
            onWheel={(e) => e.stopPropagation()}
            placeholder="Note…"
            className={`nodrag nopan min-h-[120px] w-full cursor-text resize-y rounded-lg bg-transparent px-3 py-2 outline-none placeholder:text-current/45 ${fmtClasses}`}
            spellCheck
          />
        ) : (
          <p
            className={`min-h-[120px] w-full select-none whitespace-pre-wrap break-words px-3 py-2 opacity-100 empty:after:text-current/45 empty:after:content-['Note…'] ${fmtClasses}`}
          >
            {data.body}
          </p>
        )}
      </div>
    </>
  );
}

export default NoteCard;
