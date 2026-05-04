"use client";

import { useCallback } from "react";
import { Panel, useReactFlow } from "@xyflow/react";
import {
  type NoteColorKey,
  NOTE_COLOR_KEYS,
  NOTE_COLOR_META,
} from "@/lib/noteColors";
import type { NoteFormatting, NoteFontSize } from "@/components/NoteCard";
import { useUndoContext } from "@/lib/UndoContext";

const FONT_SIZES: { key: NoteFontSize; label: string }[] = [
  { key: "sm", label: "S" },
  { key: "md", label: "M" },
  { key: "lg", label: "L" },
  { key: "xl", label: "XL" },
];

type ToolbarProps = {
  connecting: boolean;
  onToggleConnecting: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onClearBoard: () => void;
  // Note formatting — reflects the selected note's settings, or the running default.
  colorKey: NoteColorKey;
  formatting: NoteFormatting;
  defaultColorKey: NoteColorKey;
  onChangeColor: (key: NoteColorKey) => void;
  onChangeFontSize: (size: NoteFontSize) => void;
  onToggleFormat: (key: keyof Omit<NoteFormatting, "fontSize">) => void;
  // Contextual actions — enabled only when a note is selected.
  canCreateCluster: boolean;
  onCreateCluster: () => void;
  canDelete: boolean;
  onDeleteSelected: () => void;
};

export function Toolbar({
  connecting,
  onToggleConnecting,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onClearBoard,
  colorKey,
  formatting,
  defaultColorKey,
  onChangeColor,
  onChangeFontSize,
  onToggleFormat,
  canCreateCluster,
  onCreateCluster,
  canDelete,
  onDeleteSelected,
}: ToolbarProps) {
  const { addNodes, screenToFlowPosition } = useReactFlow();
  const { pushSnapshot } = useUndoContext();

  const centrePosition = useCallback(
    () =>
      screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      }),
    [screenToFlowPosition],
  );

  const addNote = useCallback(() => {
    pushSnapshot();
    addNodes({
      id: crypto.randomUUID(),
      type: "noteCard",
      position: centrePosition(),
      data: { body: "", colorKey, formatting },
    });
  }, [addNodes, centrePosition, pushSnapshot, colorKey, formatting]);

  const addCluster = useCallback(() => {
    pushSnapshot();
    addNodes({
      id: crypto.randomUUID(),
      type: "clusterNode",
      position: centrePosition(),
      data: {
        notes: [{ id: crypto.randomUUID(), body: "", colorKey: defaultColorKey }],
        colorKey: defaultColorKey,
      },
    });
  }, [addNodes, centrePosition, pushSnapshot, defaultColorKey]);

  const fontSize = formatting.fontSize ?? "md";

  return (
    <Panel
      position="top-left"
      className="!m-0 inset-x-0 w-full max-w-none border-b border-black/10 bg-white/95 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-neutral-900/95"
    >
      <div className="flex min-h-12 w-full min-w-0 flex-nowrap items-center gap-x-2 gap-y-1 overflow-x-auto px-4 py-2.5">

        {/* Undo / Redo */}
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (⌘Z)"
          className="flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-30 text-stone-600 hover:bg-black/5 hover:text-stone-900 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white disabled:hover:bg-transparent dark:disabled:hover:bg-transparent"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 14 4 9l5-5" />
            <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (⌘⇧Z)"
          className="flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-30 text-stone-600 hover:bg-black/5 hover:text-stone-900 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white disabled:hover:bg-transparent dark:disabled:hover:bg-transparent"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 14l5-5-5-5" />
            <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
          </svg>
        </button>

        <div className="mx-0.5 h-5 w-px bg-black/10 dark:bg-white/10" />

        {/* Add note / Add cluster */}
        <button
          type="button"
          onClick={addNote}
          className="rounded-lg border border-black/15 px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:border-black/30 hover:text-stone-900 dark:border-white/15 dark:text-neutral-400 dark:hover:border-white/30 dark:hover:text-white"
        >
          Add note
        </button>
        <button
          type="button"
          onClick={addCluster}
          className="rounded-lg border border-black/15 px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:border-black/30 hover:text-stone-900 dark:border-white/15 dark:text-neutral-400 dark:hover:border-white/30 dark:hover:text-white"
        >
          Add cluster
        </button>

        <div className="mx-0.5 h-5 w-px bg-black/10 dark:bg-white/10" />

        {/* Color swatches */}
        {NOTE_COLOR_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            title={NOTE_COLOR_META[key].label}
            onClick={() => onChangeColor(key)}
            className={`h-5 w-5 flex-shrink-0 rounded-md ring-2 ring-offset-1 transition-transform hover:scale-110 dark:ring-offset-neutral-800 ${NOTE_COLOR_META[key].swatch} ${colorKey === key ? "ring-black/30 dark:ring-white/40" : "ring-transparent"}`}
            aria-label={`Color: ${NOTE_COLOR_META[key].label}`}
          />
        ))}

        <div className="mx-0.5 h-5 w-px bg-black/10 dark:bg-white/10" />

        {/* Font size */}
        {FONT_SIZES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            title={`Font size: ${label}`}
            onClick={() => onChangeFontSize(key)}
            aria-pressed={fontSize === key}
            className={`flex h-7 min-w-[1.6rem] items-center justify-center rounded-md px-1 text-xs font-medium transition-colors ${fontSize === key ? "bg-black/10 text-black dark:bg-white/15 dark:text-white" : "text-black/50 hover:bg-black/5 hover:text-black dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"}`}
          >
            {label}
          </button>
        ))}

        <div className="mx-0.5 h-5 w-px bg-black/10 dark:bg-white/10" />

        {/* Bold / Italic / Underline */}
        {(
          [
            { key: "bold" as const, label: "B", title: "Bold", cls: "font-bold" },
            { key: "italic" as const, label: "I", title: "Italic", cls: "italic" },
            { key: "underline" as const, label: "U", title: "Underline", cls: "underline" },
          ] as { key: keyof Omit<NoteFormatting, "fontSize">; label: string; title: string; cls: string }[]
        ).map(({ key, label, title, cls }) => (
          <button
            key={key}
            type="button"
            title={title}
            onClick={() => onToggleFormat(key)}
            aria-pressed={!!formatting[key]}
            className={`flex h-7 w-7 items-center justify-center rounded-md text-sm transition-colors ${cls} ${formatting[key] ? "bg-black/10 text-black dark:bg-white/15 dark:text-white" : "text-black/50 hover:bg-black/5 hover:text-black dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"}`}
          >
            {label}
          </button>
        ))}

        <div className="mx-0.5 h-5 w-px bg-black/10 dark:bg-white/10" />

        {/* Create cluster (canvas note only) */}
        <button
          type="button"
          title="Create cluster from selected note"
          onClick={onCreateCluster}
          disabled={!canCreateCluster}
          className="flex h-7 items-center gap-1 rounded-md px-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-30 text-black/50 hover:bg-black/5 hover:text-black dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white disabled:hover:bg-transparent dark:disabled:hover:bg-transparent"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="8" height="8" rx="1" />
            <rect x="13" y="3" width="8" height="8" rx="1" />
            <rect x="3" y="13" width="8" height="8" rx="1" />
            <rect x="13" y="13" width="8" height="8" rx="1" />
          </svg>
          Cluster
        </button>

        {/* Delete selected note */}
        <button
          type="button"
          title="Delete selected note"
          onClick={onDeleteSelected}
          disabled={!canDelete}
          className="flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-30 text-black/40 hover:bg-red-50 hover:text-red-500 dark:text-white/30 dark:hover:bg-red-950/40 dark:hover:text-red-400 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
        </button>

        <div className="mx-0.5 h-5 w-px bg-black/10 dark:bg-white/10" />

        {/* Connection mode */}
        <button
          type="button"
          onClick={onToggleConnecting}
          title={connecting ? "Exit connection mode (Esc)" : "Enter connection mode"}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            connecting
              ? "bg-indigo-500 text-white hover:bg-indigo-600"
              : "border border-black/15 text-stone-600 hover:border-black/30 hover:text-stone-900 dark:border-white/15 dark:text-neutral-400 dark:hover:border-white/30 dark:hover:text-white"
          }`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="6" cy="6" r="3" />
            <circle cx="18" cy="18" r="3" />
            <line x1="6" y1="9" x2="6" y2="15" />
            <line x1="9" y1="6" x2="15" y2="6" />
            <line x1="18" y1="9" x2="18" y2="15" />
            <line x1="9" y1="18" x2="15" y2="18" />
            <line x1="8.5" y1="8.5" x2="15.5" y2="15.5" />
          </svg>
          Connect
        </button>

        <div className="mx-0.5 h-5 w-px bg-black/10 dark:bg-white/10" />

        {/* Clear board */}
        <button
          type="button"
          onClick={onClearBoard}
          title="Clear all notes and connections from this board"
          className="rounded-lg border border-black/15 px-3 py-1.5 text-sm font-medium text-stone-500 transition-colors hover:border-red-300 hover:text-red-600 dark:border-white/15 dark:text-neutral-500 dark:hover:border-red-500/50 dark:hover:text-red-400"
        >
          Clear
        </button>
      </div>
    </Panel>
  );
}
