"use client";

import { useRef, useState } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import {
  type NoteColorKey,
  NOTE_COLOR_META,
  DEFAULT_NOTE_COLOR,
} from "@/lib/noteColors";
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
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const colorKey = data.colorKey ?? DEFAULT_NOTE_COLOR;
  const palette = NOTE_COLOR_META[colorKey];
  const fmt = data.formatting ?? {};
  const fontSize: NoteFontSize = fmt.fontSize ?? "md";
  const isDropTarget = !!data.isDropTarget;

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
      <Handle id="t"  type="source" position={Position.Top}                                              style={{ backgroundColor: palette.handleColor, borderColor: palette.handleColor }} className="!h-2 !w-2 !rounded-full !border" />
      <Handle id="b"  type="source" position={Position.Bottom}                                           style={{ backgroundColor: palette.handleColor, borderColor: palette.handleColor }} className="!h-2 !w-2 !rounded-full !border" />
      <Handle id="l"  type="source" position={Position.Left}                                             style={{ backgroundColor: palette.handleColor, borderColor: palette.handleColor }} className="!h-2 !w-2 !rounded-full !border" />
      <Handle id="r"  type="source" position={Position.Right}                                            style={{ backgroundColor: palette.handleColor, borderColor: palette.handleColor }} className="!h-2 !w-2 !rounded-full !border" />
      <Handle id="tl" type="source" position={Position.Top}    style={{ left: 0,      backgroundColor: palette.handleColor, borderColor: palette.handleColor }} className="!h-2 !w-2 !rounded-full !border" />
      <Handle id="tr" type="source" position={Position.Top}    style={{ left: "100%", backgroundColor: palette.handleColor, borderColor: palette.handleColor }} className="!h-2 !w-2 !rounded-full !border" />
      <Handle id="bl" type="source" position={Position.Bottom} style={{ left: 0,      backgroundColor: palette.handleColor, borderColor: palette.handleColor }} className="!h-2 !w-2 !rounded-full !border" />
      <Handle id="br" type="source" position={Position.Bottom} style={{ left: "100%", backgroundColor: palette.handleColor, borderColor: palette.handleColor }} className="!h-2 !w-2 !rounded-full !border" />

      <div
        onDoubleClick={!editing ? enterEditMode : undefined}
        className={`flex w-[240px] cursor-grab flex-col rounded-lg border shadow-md outline-none ring-2 ring-offset-2 transition-all active:cursor-grabbing ${palette.cardClass} ${isDropTarget ? `${palette.selectedRing} shadow-lg scale-[1.03]` : selected ? `${palette.selectedRing} shadow-lg` : "ring-transparent"} ${editing ? "cursor-default active:cursor-default" : ""}`}
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
            className={`nodrag nopan min-h-[120px] w-full cursor-text resize-y rounded-lg bg-transparent px-3 py-2 outline-none placeholder:text-stone-400 ${fmtClasses}`}
            spellCheck
          />
        ) : (
          <p
            className={`min-h-[120px] w-full select-none whitespace-pre-wrap break-words px-3 py-2 opacity-100 empty:after:text-stone-400 empty:after:content-['Note…'] ${fmtClasses}`}
          >
            {data.body}
          </p>
        )}
      </div>
    </>
  );
}

export default NoteCard;
