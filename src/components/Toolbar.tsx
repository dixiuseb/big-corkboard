"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Panel, useReactFlow } from "@xyflow/react";
import {
  type NoteColorKey,
  NOTE_COLOR_KEYS,
  NOTE_COLOR_META,
} from "@/lib/noteColors";
import type { NoteFormatting, NoteFontSize } from "@/components/NoteCard";
import { useUndoContext } from "@/lib/UndoContext";
import { exportBoardFlowPng, type BoardPngExportMode } from "@/lib/boardPngExport";

export type WorkspaceFileMenuActions = {
  onExportWorkspaceJson: () => void;
  onRequestImportWorkspaceJson: () => void;
};

function AboutMenu() {
  const linkClass =
    "text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400";

  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<{ top: number; right: number } | null>(null);

  const updatePlacement = useCallback(() => {
    if (!open || !buttonRef.current) {
      setPlacement(null);
      return;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    setPlacement({
      top: rect.bottom + 6,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }, [open]);

  useLayoutEffect(() => {
    updatePlacement();
  }, [updatePlacement]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => updatePlacement();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, updatePlacement]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const menu =
    open &&
    placement &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={menuRef}
        role="menu"
        style={{
          position: "fixed",
          top: placement.top,
          right: placement.right,
          zIndex: 10050,
          width: "min(22rem, calc(100vw - 2rem))",
        }}
        className="rounded-lg border border-black/10 bg-white p-4 text-sm shadow-xl dark:border-white/10 dark:bg-neutral-800"
      >
        <p className="font-semibold text-stone-900 dark:text-white">Big Corkboard</p>
        <p className="mt-2 leading-relaxed text-stone-600 dark:text-neutral-300">
          An infinite digital canvas for writers and creatives.
        </p>
        <p className="mt-3 leading-relaxed text-stone-600 dark:text-neutral-300">
          Built by{" "}
          <a
            href="https://www.ethandixius.com"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            Ethan Dixius
          </a>
          {" · "}v1.0{" · "}
          <a
            href="https://github.com/dixiuseb/big-corkboard"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            GitHub
          </a>
        </p>
      </div>,
      document.body,
    );

  return (
    <div className="relative flex-shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-black/15 px-2.5 text-xs font-medium text-stone-600 transition-colors hover:border-black/30 hover:text-stone-900 dark:border-white/15 dark:text-neutral-400 dark:hover:border-white/30 dark:hover:text-white"
      >
        About
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${open ? "rotate-180" : ""}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {menu}
    </div>
  );
}

function FileMenu({
  boardTitle,
  workspaceFile,
}: {
  boardTitle: string;
  workspaceFile: WorkspaceFileMenuActions;
}) {
  const { fitView, getViewport, setViewport, getNodes } = useReactFlow();
  const [open, setOpen] = useState(false);
  const [exportingPng, setExportingPng] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<{ top: number; right: number } | null>(null);

  const updatePlacement = useCallback(() => {
    if (!open || !buttonRef.current) {
      setPlacement(null);
      return;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    setPlacement({
      top: rect.bottom + 6,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }, [open]);

  useLayoutEffect(() => {
    updatePlacement();
  }, [updatePlacement]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => updatePlacement();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, updatePlacement]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const runExport = useCallback(
    async (mode: BoardPngExportMode) => {
      const el = document.querySelector("[data-corkboard-react-flow]");
      if (!(el instanceof HTMLElement)) {
        window.alert("Could not find the canvas to export.");
        return;
      }
      setExportingPng(true);
      try {
        await exportBoardFlowPng(el, boardTitle, mode, {
          fitView,
          getViewport,
          setViewport,
          getNodes,
        });
        setOpen(false);
      } catch (e) {
        console.error(e);
        window.alert("PNG export failed. Try again, or close other overlays and retry.");
      } finally {
        setExportingPng(false);
      }
    },
    [boardTitle, fitView, getViewport, setViewport, getNodes],
  );

  const menu =
    open &&
    placement &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={menuRef}
        role="menu"
        style={{
          position: "fixed",
          top: placement.top,
          right: placement.right,
          zIndex: 10050,
          width: "min(20rem, calc(100vw - 2rem))",
        }}
        className="rounded-lg border border-black/10 bg-white py-1 text-sm shadow-xl dark:border-white/10 dark:bg-neutral-800"
      >
        <div className="border-b border-black/8 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-black/40 dark:border-white/8 dark:text-white/40">
          File
        </div>
        <button
          type="button"
          role="menuitem"
          disabled={exportingPng}
          onClick={() => void runExport("viewport")}
          className="flex w-full px-3 py-2 text-left text-stone-700 transition-colors hover:bg-black/5 disabled:cursor-wait disabled:opacity-60 dark:text-neutral-200 dark:hover:bg-white/8"
        >
          Export PNG (current view)…
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={exportingPng}
          onClick={() => void runExport("fitAll")}
          className="flex w-full px-3 py-2 text-left text-stone-700 transition-colors hover:bg-black/5 disabled:cursor-wait disabled:opacity-60 dark:text-neutral-200 dark:hover:bg-white/8"
        >
          Export PNG (fit all notes)…
        </button>
        <div className="mx-3 my-1 h-px bg-black/8 dark:bg-white/8" />
        <button
          type="button"
          role="menuitem"
          disabled={exportingPng}
          onClick={() => {
            try {
              workspaceFile.onExportWorkspaceJson();
              setOpen(false);
            } catch (e) {
              console.error(e);
              window.alert("Could not export the workspace.");
            }
          }}
          className="flex w-full px-3 py-2 text-left text-stone-700 transition-colors hover:bg-black/5 disabled:cursor-wait disabled:opacity-60 dark:text-neutral-200 dark:hover:bg-white/8"
        >
          Export workspace as JSON…
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={exportingPng}
          onClick={() => {
            setOpen(false);
            workspaceFile.onRequestImportWorkspaceJson();
          }}
          className="flex w-full px-3 py-2 text-left text-stone-700 transition-colors hover:bg-black/5 disabled:cursor-wait disabled:opacity-60 dark:text-neutral-200 dark:hover:bg-white/8"
        >
          Import workspace…
        </button>
      </div>,
      document.body,
    );

  return (
    <div className="relative flex-shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={exportingPng}
        title="File — export PNG, backup workspace JSON, import workspace"
        className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-black/15 px-2.5 text-xs font-medium text-stone-600 transition-colors hover:border-black/30 hover:text-stone-900 disabled:cursor-wait disabled:opacity-60 dark:border-white/15 dark:text-neutral-400 dark:hover:border-white/30 dark:hover:text-white"
      >
        File
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${open ? "rotate-180" : ""}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {menu}
    </div>
  );
}

const FONT_SIZES: { key: NoteFontSize; label: string }[] = [
  { key: "sm", label: "S" },
  { key: "md", label: "M" },
  { key: "lg", label: "L" },
  { key: "xl", label: "XL" },
];

export type CanvasTool = "pan" | "select";

type ToolbarProps = {
  canvasTool: CanvasTool;
  onCanvasToolChange: (tool: CanvasTool) => void;
  connecting: boolean;
  onToggleConnecting: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  searchOpen: boolean;
  onOpenSearch: () => void;
  /** Active board tab title — used in PNG export filenames. */
  boardTitle: string;
  workspaceFile: WorkspaceFileMenuActions;
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
  canvasTool,
  onCanvasToolChange,
  connecting,
  onToggleConnecting,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  searchOpen,
  onOpenSearch,
  boardTitle,
  workspaceFile,
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

  /** Shift mirrors Select in the UI while Pan mode stays the stored tool. */
  const [shiftHeld, setShiftHeld] = useState(false);
  useEffect(() => {
    const sync = (e: KeyboardEvent) => setShiftHeld(e.shiftKey);
    const clear = () => setShiftHeld(false);
    const onVis = () => {
      if (document.visibilityState === "hidden") setShiftHeld(false);
    };
    window.addEventListener("keydown", sync);
    window.addEventListener("keyup", sync);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("keydown", sync);
      window.removeEventListener("keyup", sync);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const panLooksActive = canvasTool === "pan" && !shiftHeld;
  const selectLooksActive = canvasTool === "select" || shiftHeld;

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
      className="!m-0 inset-x-0 w-full max-w-none overflow-visible border-b border-black/10 bg-white/95 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-neutral-900/95"
    >
      {/* Single min-h-12 + py-2.5 matches original toolbar height; avoid nesting another min-h-12 (adds extra vertical space). */}
      <div className="flex min-h-12 w-full min-w-0 items-center gap-2 px-4 py-2.5">
        <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-x-2 gap-y-1 overflow-x-auto">

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
        <button
          type="button"
          onClick={onOpenSearch}
          title="Search notes (⌘F)"
          aria-pressed={searchOpen}
          className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors text-stone-600 hover:bg-black/5 hover:text-stone-900 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white ${
            searchOpen ? "bg-indigo-500/15 text-indigo-700 dark:bg-indigo-400/20 dark:text-indigo-300" : ""
          }`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="6" />
            <path d="m20 20-4.3-4.3" />
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

        {/* Create cluster: one note → promote; multiple notes only → combine */}
        <button
          type="button"
          title="Cluster — turn one note into a cluster, or combine several selected notes (⌘/Ctrl-click to multi-select)"
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

        {/* Delete selected canvas nodes and/or panel note */}
        <button
          type="button"
          title="Delete selected items"
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

        <div className="flex overflow-hidden rounded-lg border border-black/15 dark:border-white/15">
          <button
            type="button"
            onClick={() => onCanvasToolChange("pan")}
            title="Pan — drag the canvas with the left mouse button (default)"
            aria-pressed={panLooksActive}
            className={`border-0 px-2.5 py-1.5 text-xs font-medium transition-colors ${
              panLooksActive
                ? "bg-indigo-500/15 text-indigo-700 dark:bg-indigo-400/20 dark:text-indigo-300"
                : "bg-transparent text-stone-600 hover:bg-black/5 hover:text-stone-900 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white"
            }`}
          >
            Pan
          </button>
          <button
            type="button"
            onClick={() => onCanvasToolChange("select")}
            title="Select — drag on empty canvas to select notes (same as Shift in Pan). Middle or right mouse still pans."
            aria-pressed={selectLooksActive}
            className={`border-0 border-l border-black/10 px-2.5 py-1.5 text-xs font-medium transition-colors dark:border-white/10 ${
              selectLooksActive
                ? "bg-indigo-500/15 text-indigo-700 dark:bg-indigo-400/20 dark:text-indigo-300"
                : "bg-transparent text-stone-600 hover:bg-black/5 hover:text-stone-900 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white"
            }`}
          >
            Select
          </button>
        </div>

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

        <div className="flex shrink-0 items-center gap-1.5">
          <FileMenu boardTitle={boardTitle} workspaceFile={workspaceFile} />
          <AboutMenu />
        </div>
      </div>
    </Panel>
  );
}
