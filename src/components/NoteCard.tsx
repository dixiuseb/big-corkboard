"use client";

import { useRef, useState } from "react";
import {
  Handle,
  NodeToolbar,
  Position,
  useReactFlow,
} from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import {
  type NoteColorKey,
  NOTE_COLOR_KEYS,
  NOTE_COLOR_META,
  DEFAULT_NOTE_COLOR,
} from "@/lib/noteColors";

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
};

export type NoteFlowNode = Node<NoteNodeData, "noteCard">;

const FONT_SIZE_CLASSES: Record<NoteFontSize, string> = {
  sm: "text-xs leading-relaxed",
  md: "text-sm leading-relaxed",
  lg: "text-base leading-relaxed",
  xl: "text-lg leading-relaxed",
};

const FONT_SIZES: { key: NoteFontSize; label: string }[] = [
  { key: "sm", label: "S" },
  { key: "md", label: "M" },
  { key: "lg", label: "L" },
  { key: "xl", label: "XL" },
];

function NoteCard({ id, data, selected }: NodeProps<NoteFlowNode>) {
  const { updateNodeData, deleteElements, addNodes, getNode } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const colorKey = data.colorKey ?? DEFAULT_NOTE_COLOR;
  const palette = NOTE_COLOR_META[colorKey];
  const fmt = data.formatting ?? {};
  const fontSize: NoteFontSize = fmt.fontSize ?? "md";

  const updateBody = (body: string) => updateNodeData(id, { body });

  const toggleFormat = (key: keyof Omit<NoteFormatting, "fontSize">) =>
    updateNodeData(id, { formatting: { ...fmt, [key]: !fmt[key] } });

  const setFontSize = (size: NoteFontSize) =>
    updateNodeData(id, { formatting: { ...fmt, fontSize: size } });

  const setColor = (key: NoteColorKey) => updateNodeData(id, { colorKey: key });

  const deleteNote = () => deleteElements({ nodes: [{ id }] });

  const createCluster = () => {
    const currentNode = getNode(id);
    if (!currentNode) return;
    addNodes({
      id: crypto.randomUUID(),
      type: "clusterNode",
      position: currentNode.position,
      data: {
        notes: [
          {
            id: crypto.randomUUID(),
            body: data.body,
            colorKey: data.colorKey ?? DEFAULT_NOTE_COLOR,
            formatting: data.formatting,
          },
        ],
        colorKey: data.colorKey ?? DEFAULT_NOTE_COLOR,
      },
    } as Node);
    deleteElements({ nodes: [{ id }] });
  };

  const enterEditMode = () => {
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

  const showToolbar = selected && !editing;

  return (
    <>
      {/* ── Selection popup ── */}
      <NodeToolbar isVisible={showToolbar} position={Position.Top} offset={10}>
        <div className="flex items-center gap-1 rounded-xl border border-black/10 bg-white px-2 py-1.5 shadow-xl">
          {/* Color swatches */}
          {NOTE_COLOR_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              title={NOTE_COLOR_META[key].label}
              onClick={() => setColor(key)}
              className={`h-6 w-6 rounded-md ring-2 ring-offset-1 transition-transform hover:scale-110 ${NOTE_COLOR_META[key].swatch} ${colorKey === key ? "ring-black/30" : "ring-transparent"}`}
              aria-label={`Color: ${NOTE_COLOR_META[key].label}`}
            />
          ))}

          <div className="mx-1 h-5 w-px bg-black/10" />

          {/* Font size */}
          {FONT_SIZES.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              title={`Font size: ${label}`}
              onClick={() => setFontSize(key)}
              aria-pressed={fontSize === key}
              className={`flex h-7 min-w-[1.75rem] items-center justify-center rounded-md px-1 text-xs font-medium transition-colors ${fontSize === key ? "bg-black/10 text-black" : "text-black/50 hover:bg-black/5 hover:text-black"}`}
            >
              {label}
            </button>
          ))}

          <div className="mx-1 h-5 w-px bg-black/10" />

          {/* Bold / Italic / Underline */}
          {(
            [
              { key: "bold", label: "B", title: "Bold", cls: "font-bold" },
              { key: "italic", label: "I", title: "Italic", cls: "italic" },
              { key: "underline", label: "U", title: "Underline", cls: "underline" },
            ] as { key: keyof Omit<NoteFormatting, "fontSize">; label: string; title: string; cls: string }[]
          ).map(({ key, label, title, cls }) => (
            <button
              key={key}
              type="button"
              title={title}
              onClick={() => toggleFormat(key)}
              aria-pressed={!!fmt[key]}
              className={`flex h-7 w-7 items-center justify-center rounded-md text-sm transition-colors ${cls} ${fmt[key] ? "bg-black/10 text-black" : "text-black/50 hover:bg-black/5 hover:text-black"}`}
            >
              {label}
            </button>
          ))}

          <div className="mx-1 h-5 w-px bg-black/10" />

          {/* Create cluster */}
          <button
            type="button"
            title="Create cluster"
            onClick={createCluster}
            className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-black/50 transition-colors hover:bg-black/5 hover:text-black"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="8" height="8" rx="1" />
              <rect x="13" y="3" width="8" height="8" rx="1" />
              <rect x="3" y="13" width="8" height="8" rx="1" />
              <rect x="13" y="13" width="8" height="8" rx="1" />
            </svg>
            Cluster
          </button>

          <div className="mx-1 h-5 w-px bg-black/10" />

          {/* Delete */}
          <button
            type="button"
            title="Delete note"
            onClick={deleteNote}
            className="flex h-7 w-7 items-center justify-center rounded-md text-black/40 transition-colors hover:bg-red-50 hover:text-red-500"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
          </button>
        </div>
      </NodeToolbar>

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
        className={`flex w-[240px] cursor-grab flex-col rounded-lg border shadow-md outline-none ring-2 ring-offset-1 transition-shadow active:cursor-grabbing ${palette.cardClass} ${selected ? `${palette.selectedRing} shadow-lg` : "ring-transparent"} ${editing ? "cursor-default active:cursor-default" : ""}`}
      >
        {editing ? (
          <textarea
            ref={textareaRef}
            value={data.body}
            onChange={(e) => updateBody(e.target.value)}
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
