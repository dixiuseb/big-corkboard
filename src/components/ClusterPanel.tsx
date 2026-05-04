"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  NOTE_COLOR_META,
  DEFAULT_NOTE_COLOR,
} from "@/lib/noteColors";
import type { ClusterNoteItem } from "@/components/ClusterNode";
import { useUndoContext } from "@/lib/UndoContext";

type ClusterPanelProps = {
  clusterId: string;
  notes: ClusterNoteItem[];
  onUpdateNote: (noteId: string, update: Partial<ClusterNoteItem>) => void;
  onDeleteNote: (noteId: string) => void;
  onEjectNote: (noteId: string) => void;
  onAddNote: () => void;
  onClose: () => void;
  onDeleteCluster: () => void;
  onUncluster: () => void;
  onReorderNotes: (reorderedNotes: ClusterNoteItem[]) => void;
  clearGhostRef?: React.MutableRefObject<() => void>;
  selectedNoteId: string | null;
  onSelectNote: (id: string | null) => void;
};

function PanelNoteCard({
  note,
  selected,
  onSelect,
  onUpdate,
  onEject,
  onPushSnapshot,
  onDragStartReorder,
  onDragEnterCard,
  onDragEndReorder,
  onDragStartGhost,
  onDragMoveGhost,
  onDragEndGhost,
}: {
  note: ClusterNoteItem;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (update: Partial<ClusterNoteItem>) => void;
  onEject: () => void;
  onPushSnapshot: () => void;
  onDragStartReorder: () => void;
  onDragEnterCard: () => void;
  onDragEndReorder: () => void;
  onDragStartGhost: (x: number, y: number) => void;
  onDragMoveGhost: (x: number, y: number) => void;
  onDragEndGhost: () => void;
}) {
  const colorKey = note.colorKey ?? DEFAULT_NOTE_COLOR;
  const palette = NOTE_COLOR_META[colorKey];
  const fmt = note.formatting ?? {};
  const fmtClasses = [
    fmt.bold ? "font-bold" : "",
    fmt.italic ? "italic" : "",
    fmt.underline ? "underline" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div
      onClick={onSelect}
      onDragEnter={onDragEnterCard}
      className={`group relative cursor-pointer rounded-lg border shadow-sm transition-shadow ${palette.cardClass} ${selected ? `ring-2 ring-offset-1 ${palette.selectedRing}` : "ring-0"}`}
    >
      {/* Drag handle — drag within panel to reorder; drag onto canvas to pull out. */}
      <div
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("application/x-corkboard-note", JSON.stringify(note));
          // Suppress the browser's default ghost image so our custom ghost takes over.
          const empty = new Image();
          empty.src =
            "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
          e.dataTransfer.setDragImage(empty, 0, 0);
          onDragStartReorder();
          onDragStartGhost(e.clientX, e.clientY);
        }}
        onDrag={(e) => {
          // clientX/Y are 0,0 on the final event before dragend — skip those.
          if (e.clientX !== 0 || e.clientY !== 0) {
            onDragMoveGhost(e.clientX, e.clientY);
          }
        }}
        onDragEnd={(e) => {
          onDragEndReorder();
          onDragEndGhost();
          void e;
        }}
        title="Drag to reorder or drag to canvas to pull out"
        className="flex cursor-grab items-center justify-center py-1 opacity-0 transition-opacity group-hover:opacity-40 active:cursor-grabbing"
      >
        <svg width="14" height="8" viewBox="0 0 14 8" fill="currentColor">
          <circle cx="2" cy="2" r="1.2" />
          <circle cx="7" cy="2" r="1.2" />
          <circle cx="12" cy="2" r="1.2" />
          <circle cx="2" cy="6" r="1.2" />
          <circle cx="7" cy="6" r="1.2" />
          <circle cx="12" cy="6" r="1.2" />
        </svg>
      </div>

      <textarea
        ref={textareaRef}
        value={note.body}
        onChange={(e) => onUpdate({ body: e.target.value })}
        onFocus={() => { onSelect(); onPushSnapshot(); }}
        onWheel={(e) => e.stopPropagation()}
        placeholder="Note…"
        rows={3}
        className={`w-full resize-y bg-transparent px-3 py-2 text-sm outline-none placeholder:text-stone-400 ${fmtClasses}`}
        spellCheck
      />
      <button
        type="button"
        title="Eject note to canvas"
        onClick={(e) => { e.stopPropagation(); onEject(); }}
        className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded text-current/30 opacity-0 transition-all group-hover:opacity-100 hover:bg-black/8 hover:text-current/70"
      >
        {/* Arrow pointing left — visually communicates "send to canvas" */}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      </button>
    </div>
  );
}

export function ClusterPanel({
  notes,
  onUpdateNote,
  onDeleteNote,
  onEjectNote,
  onAddNote,
  onClose,
  onDeleteCluster,
  onUncluster,
  onReorderNotes,
  clearGhostRef,
  selectedNoteId,
  onSelectNote,
}: ClusterPanelProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { pushSnapshot } = useUndoContext();

  // ── Reorder drag state ────────────────────────────────────────────────────
  const [reorderDragIndex, setReorderDragIndex] = useState<number | null>(null);
  const [reorderOverIndex, setReorderOverIndex] = useState<number | null>(null);

  // ── Drag-out ghost state ──────────────────────────────────────────────────
  const [ghostNote, setGhostNote] = useState<ClusterNoteItem | null>(null);
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Hold a stable reference to the current dragend cleanup so we can remove it.
  // We register the listener synchronously inside the drag-start callback (not in a
  // useEffect) because useEffect runs after the paint — too late for a fast drag that
  // starts and ends before the next frame.
  const ghostListenerRef = useRef<(() => void) | null>(null);

  const startGhost = useCallback((note: ClusterNoteItem, x: number, y: number) => {
    // Clear any stale listener from a previous drag that never fully cleaned up.
    if (ghostListenerRef.current) {
      document.removeEventListener("dragend", ghostListenerRef.current);
    }
    const clear = () => {
      setGhostNote(null);
      ghostListenerRef.current = null;
    };
    ghostListenerRef.current = clear;
    document.addEventListener("dragend", clear, { once: true });
    setGhostNote(note);
    setGhostPos({ x, y });
  }, []);

  const endGhost = useCallback(() => {
    setGhostNote(null);
    // If the element's onDragEnd fires first, remove the document listener so it
    // doesn't double-fire.
    if (ghostListenerRef.current) {
      document.removeEventListener("dragend", ghostListenerRef.current);
      ghostListenerRef.current = null;
    }
  }, []);

  // Let BoardCanvas call endGhost directly via the ref it passes down.
  // This fires synchronously inside handleCanvasDrop, guaranteeing the ghost
  // clears even when the drag source unmounts before "dragend" can fire.
  useLayoutEffect(() => {
    if (clearGhostRef) clearGhostRef.current = endGhost;
  }, [clearGhostRef, endGhost]);

  const handleReorderDragEnd = () => {
    setReorderDragIndex(null);
    setReorderOverIndex(null);
  };

  const handleListDrop = (e: React.DragEvent) => {
    // Always stop propagation so drops anywhere inside the panel never reach
    // the canvas drop handler — notes stay in the cluster if released here.
    e.stopPropagation();
    if (
      reorderDragIndex !== null &&
      reorderOverIndex !== null &&
      reorderDragIndex !== reorderOverIndex
    ) {
      const next = [...notes];
      const [moved] = next.splice(reorderDragIndex, 1);
      next.splice(reorderOverIndex, 0, moved);
      onReorderNotes(next);
    }
    handleReorderDragEnd();
  };

  const ghostPalette = NOTE_COLOR_META[ghostNote?.colorKey ?? DEFAULT_NOTE_COLOR];

  return (
    <>
    {/* Ghost card that follows the cursor during drag-out */}
    {ghostNote && (
      <div
        className={`pointer-events-none fixed z-[9999] w-60 rounded-xl border shadow-2xl ${ghostPalette.cardClass}`}
        style={{
          left: ghostPos.x - 120,
          top: ghostPos.y - 24,
          transform: "rotate(-2deg) scale(1.03)",
          opacity: 0.92,
          transition: "none",
        }}
        aria-hidden
      >
        <p className="px-3 py-3 text-sm leading-snug text-stone-700">
          {ghostNote.body || <span className="text-stone-400 italic">Note…</span>}
        </p>
      </div>
    )}
    <div className="pointer-events-none fixed bottom-9 right-0 top-14 z-50 flex w-80 flex-col">
      {/* pointer-events-auto wrapper also absorbs all drag events so dropping
          anywhere over the panel never falls through to the canvas handler. */}
      <div
        className="pointer-events-auto flex h-full flex-col rounded-l-2xl border-y border-l border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-neutral-900"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("application/x-corkboard-note")) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onDrop={(e) => e.stopPropagation()}
      >

        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/8 px-4 py-3 dark:border-white/8">
          <h2 className="text-sm font-semibold text-black/70 dark:text-white/70">Cluster notes</h2>
          <button
            type="button"
            title="Collapse"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-black/40 transition-colors hover:bg-black/5 hover:text-black dark:text-white/40 dark:hover:bg-white/8 dark:hover:text-white"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Notes list — also the primary reorder drop zone */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4"
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("application/x-corkboard-note")) {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = "move";
            }
          }}
          onDrop={handleListDrop}
        >
          {notes.length === 0 ? (
            <p className="pt-8 text-center text-sm text-black/30 dark:text-white/30">No notes yet</p>
          ) : (
            <div className="space-y-2.5">
              {notes.map((note, i) => {
                const showInsertLine =
                  reorderDragIndex !== null &&
                  reorderOverIndex === i &&
                  reorderDragIndex !== i;
                return (
                  <div key={note.id}>
                    {/* Insertion indicator — appears above the drop-target card */}
                    {showInsertLine && (
                      <div className="mb-1.5 mx-1 h-0.5 rounded-full bg-indigo-400" />
                    )}
                    <PanelNoteCard
                      note={note}
                      selected={selectedNoteId === note.id}
                      onSelect={() => onSelectNote(note.id)}
                      onUpdate={(update) => onUpdateNote(note.id, update)}
                      onEject={() => onEjectNote(note.id)}
                      onPushSnapshot={pushSnapshot}
                      onDragStartReorder={() => setReorderDragIndex(i)}
                      onDragEnterCard={() => setReorderOverIndex(i)}
                      onDragEndReorder={handleReorderDragEnd}
                      onDragStartGhost={(x, y) => startGhost(note, x, y)}
                      onDragMoveGhost={(x, y) => setGhostPos({ x, y })}
                      onDragEndGhost={endGhost}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="space-y-2 border-t border-black/8 px-4 py-3 dark:border-white/8">
          <button
            type="button"
            onClick={onAddNote}
            className="w-full rounded-lg border border-dashed border-black/20 py-2 text-sm text-black/40 transition-colors hover:border-black/30 hover:text-black/60 dark:border-white/20 dark:text-white/40 dark:hover:border-white/30 dark:hover:text-white/60"
          >
            + Add note
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onUncluster}
              className="flex-1 rounded-lg border border-black/15 py-1.5 text-xs text-black/50 transition-colors hover:border-black/25 hover:text-black/70 dark:border-white/15 dark:text-white/50 dark:hover:border-white/25 dark:hover:text-white/70"
            >
              Un-cluster
            </button>
            {showDeleteConfirm ? (
              <div className="flex flex-1 gap-1">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 rounded-lg border border-black/15 py-1.5 text-xs text-black/50 transition-colors hover:bg-black/5 dark:border-white/15 dark:text-white/50 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onDeleteCluster}
                  className="flex-1 rounded-lg bg-red-500 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex-1 rounded-lg border border-red-200 py-1.5 text-xs text-red-400 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-500 dark:border-red-900 dark:text-red-400 dark:hover:border-red-700 dark:hover:bg-red-950/30"
              >
                Delete cluster
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
