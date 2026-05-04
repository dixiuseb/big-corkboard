"use client";

import { useCallback, useRef, useState } from "react";
import type { BoardMeta } from "@/lib/persistence";

const MAX_BOARDS = 8;

type Props = {
  boards: BoardMeta[];
  activeId: string;
  onSwitch: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onReorder: (newBoards: BoardMeta[]) => void;
};

export function BoardTabs({
  boards,
  activeId,
  onSwitch,
  onAdd,
  onDelete,
  onRename,
  onReorder,
}: Props) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // ── Rename ─────────────────────────────────────────────────────────────────

  const startRename = useCallback((board: BoardMeta) => {
    setRenamingId(board.id);
    setRenameValue(board.title);
  }, []);

  const commitRename = useCallback(() => {
    if (renamingId && renameValue.trim()) {
      onRename(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  }, [renamingId, renameValue, onRename]);

  // ── Drag-to-reorder ────────────────────────────────────────────────────────

  const handleDragStart = (i: number, e: React.DragEvent) => {
    dragIndexRef.current = i;
    // A minimal ghost — just the tab text.
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(i);
  };

  const handleDrop = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    const from = dragIndexRef.current;
    dragIndexRef.current = null;
    setDragOverIndex(null);
    if (from === null || from === i) return;
    const next = [...boards];
    const [moved] = next.splice(from, 1);
    next.splice(i, 0, moved);
    onReorder(next);
  };

  const handleDragEnd = () => {
    dragIndexRef.current = null;
    setDragOverIndex(null);
  };

  return (
    <div className="flex h-9 flex-shrink-0 items-stretch border-t border-black/10 bg-neutral-50 dark:border-white/10 dark:bg-neutral-950">
      {/* Scrollable tab strip */}
      <div className="flex min-w-0 flex-1 items-end overflow-x-auto">
        {boards.map((board, i) => {
          const isActive = board.id === activeId;
          const isDragTarget = dragOverIndex === i && dragIndexRef.current !== i;

          return (
            <div
              key={board.id}
              draggable
              onDragStart={(e) => handleDragStart(i, e)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={(e) => handleDrop(e, i)}
              onDragEnd={handleDragEnd}
              onClick={() => !isActive && !renamingId && onSwitch(board.id)}
              onDoubleClick={() => startRename(board)}
              className={[
                "group relative flex h-8 min-w-0 max-w-[160px] flex-shrink-0 cursor-pointer select-none items-center gap-1 rounded-t-md border-x border-t px-2.5 text-sm transition-colors",
                isActive
                  ? "border-black/10 bg-white text-stone-800 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-100"
                  : "border-transparent text-stone-400 hover:bg-white/70 hover:text-stone-700 dark:text-neutral-600 dark:hover:bg-neutral-800/60 dark:hover:text-neutral-300",
                isDragTarget ? "ring-2 ring-inset ring-indigo-400" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {/* Active indicator */}
              {isActive && (
                <span className="absolute inset-x-0 top-0 h-0.5 rounded-full bg-indigo-500" />
              )}

              {/* Title / rename input */}
              {renamingId === board.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); commitRename(); }
                    if (e.key === "Escape") { e.preventDefault(); setRenamingId(null); }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="min-w-0 flex-1 truncate bg-transparent text-sm outline-none"
                />
              ) : (
                <span className="min-w-0 flex-1 truncate">{board.title}</span>
              )}

              {/* Delete button */}
              {!renamingId && (
                <button
                  type="button"
                  title={`Delete "${board.title}"`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(board.id);
                  }}
                  className={[
                    "flex h-4 w-4 flex-shrink-0 items-center justify-center rounded transition-colors hover:bg-black/10 hover:text-red-500 dark:hover:bg-white/10 dark:hover:text-red-400",
                    isActive
                      ? "opacity-40 hover:opacity-100"
                      : "opacity-0 group-hover:opacity-40 group-hover:hover:opacity-100",
                  ].join(" ")}
                >
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <line x1="1" y1="1" x2="7" y2="7" />
                    <line x1="7" y1="1" x2="1" y2="7" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add-board button — hidden at the max cap */}
      {boards.length < MAX_BOARDS && (
        <button
          type="button"
          onClick={onAdd}
          title="Add board"
          className="flex w-9 flex-shrink-0 items-center justify-center text-stone-400 transition-colors hover:bg-black/5 hover:text-stone-600 dark:text-neutral-600 dark:hover:bg-white/5 dark:hover:text-neutral-400"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <line x1="7" y1="2" x2="7" y2="12" />
            <line x1="2" y1="7" x2="12" y2="7" />
          </svg>
        </button>
      )}
    </div>
  );
}
