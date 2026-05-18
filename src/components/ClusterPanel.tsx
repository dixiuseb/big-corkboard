"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  NOTE_COLOR_META,
  DEFAULT_NOTE_COLOR,
} from "@/lib/noteColors";
import type { ClusterMember, ClusterNoteItem } from "@/lib/clusterMembers";
import { isNestedClusterMember, movePanelLeafNote } from "@/lib/clusterMembers";
import { useCategoryFilter } from "@/lib/CategoryFilterContext";
import { noteColorMatchesFilter } from "@/lib/categoryFilterMatch";
import { useSearchSession } from "@/lib/SearchContext";
import { useUndoContext } from "@/lib/UndoContext";

type ClusterPanelProps = {
  clusterId: string;
  notes: ClusterMember[];
  onUpdateNote: (noteId: string, update: Partial<ClusterNoteItem>) => void;
  onDeleteNote: (noteId: string) => void;
  onEjectNote: (noteId: string) => void;
  onAddNote: () => void;
  onClose: () => void;
  onDeleteCluster: () => void;
  onUncluster: () => void;
  onReorderNotes: (reorderedMembers: ClusterMember[]) => void;
  clearGhostRef?: React.MutableRefObject<() => void>;
  selectedNoteId: string | null;
  onSelectNote: (id: string | null) => void;
};

function PanelNoteCard({
  clusterId,
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
  clusterId: string;
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
  const categoryFilter = useCategoryFilter();
  const search = useSearchSession();
  const filterDimmed =
    categoryFilter !== null && !noteColorMatchesFilter(note.colorKey, categoryFilter);
  const searchDimmed =
    search.dimNonMatches &&
    !search.isPassiveClusterNoteMatch(clusterId, note.id) &&
    !search.isActiveClusterNoteMatch(clusterId, note.id);
  const dimmed = filterDimmed || searchDimmed;
  const passiveSearch = search.isPassiveClusterNoteMatch(clusterId, note.id);
  const activeSearch = search.isActiveClusterNoteMatch(clusterId, note.id);

  let ringClass = "ring-0";
  if (activeSearch) {
    ringClass = `ring-4 ring-offset-1 ring-offset-white shadow-md dark:ring-offset-neutral-900 ${palette.selectedRing}`;
  } else if (selected) {
    ringClass = `ring-2 ring-offset-1 ring-offset-white dark:ring-offset-neutral-900 ${palette.selectedRing}`;
  } else if (passiveSearch) {
    ringClass = `ring-2 ring-offset-1 ring-offset-white dark:ring-offset-neutral-900 ${palette.selectedRing}`;
  }
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
      className={`group relative cursor-pointer rounded-lg border shadow-sm transition-[opacity,box-shadow] ${palette.cardClass} ${ringClass} ${dimmed ? "opacity-[0.38]" : ""}`}
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
        className={`w-full resize-y bg-transparent px-3 py-2 text-sm outline-none placeholder:text-current/45 ${fmtClasses}`}
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
  clusterId,
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

  type PanelLeafDragState = {
    noteId: string;
    source:
      | { kind: "root"; memberIndex: number }
      | { kind: "nested"; nestedId: string; noteIndex: number };
    target:
      | { kind: "root"; insertBeforeMemberIndex: number }
      | { kind: "nested"; nestedId: string; insertBeforeNoteIndex: number }
      | null;
  };

  const [panelDrag, setPanelDrag] = useState<PanelLeafDragState | null>(null);

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

  const clearPanelDrag = () => {
    setPanelDrag(null);
  };

  const toDropTarget = (
    t: NonNullable<PanelLeafDragState["target"]>,
  ): Parameters<typeof movePanelLeafNote>[2] =>
    t.kind === "root"
      ? { type: "root", insertBeforeMemberIndex: t.insertBeforeMemberIndex }
      : { type: "nested", nestedId: t.nestedId, insertBeforeNoteIndex: t.insertBeforeNoteIndex };

  const handleListDrop = (e: React.DragEvent) => {
    // Always stop propagation so drops anywhere inside the panel never reach
    // the canvas drop handler — notes stay in the cluster if released here.
    e.stopPropagation();
    if (!panelDrag?.noteId) {
      endGhost();
      clearPanelDrag();
      return;
    }
    if (!panelDrag.target) {
      endGhost();
      clearPanelDrag();
      return;
    }
    const next = movePanelLeafNote(notes, panelDrag.noteId, toDropTarget(panelDrag.target));
    // Clear ghost before commit: cross-boundary reorder can unmount the drag handle
    // before dragend, so onDragEndGhost never runs (same idea as clearGhostRef on canvas).
    endGhost();
    if (next !== notes) onReorderNotes(next);
    clearPanelDrag();
  };

  const handleNestedListDrop = (e: React.DragEvent, nestedClusterId: string) => {
    e.stopPropagation();
    if (!panelDrag?.noteId) {
      endGhost();
      clearPanelDrag();
      return;
    }

    let dest: Parameters<typeof movePanelLeafNote>[2];
    if (panelDrag.target?.kind === "root") {
      dest = toDropTarget(panelDrag.target);
    } else if (panelDrag.target?.kind === "nested" && panelDrag.target.nestedId === nestedClusterId) {
      dest = {
        type: "nested",
        nestedId: nestedClusterId,
        insertBeforeNoteIndex: panelDrag.target.insertBeforeNoteIndex,
      };
    } else {
      const block = notes.find((m) => isNestedClusterMember(m) && m.id === nestedClusterId);
      dest = {
        type: "nested",
        nestedId: nestedClusterId,
        insertBeforeNoteIndex:
          block !== undefined && isNestedClusterMember(block) ? block.notes.length : 0,
      };
    }

    const next = movePanelLeafNote(notes, panelDrag.noteId, dest);
    // Clear ghost before commit: cross-boundary reorder can unmount the drag handle
    // before dragend, so onDragEndGhost never runs (same idea as clearGhostRef on canvas).
    endGhost();
    if (next !== notes) onReorderNotes(next);
    clearPanelDrag();
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
              {notes.map((member, i) => {
                const showRootInsertBefore =
                  panelDrag?.target?.kind === "root" &&
                  panelDrag.target.insertBeforeMemberIndex === i &&
                  !(panelDrag.source.kind === "root" && panelDrag.source.memberIndex === i);

                if (isNestedClusterMember(member)) {
                  const showNestedAppendLine =
                    panelDrag?.target?.kind === "nested" &&
                    panelDrag.target.nestedId === member.id &&
                    panelDrag.target.insertBeforeNoteIndex === member.notes.length;

                  return (
                    <div
                      key={member.id}
                      className="space-y-2 border-l-2 border-indigo-400/50 pl-3 dark:border-indigo-400/35"
                      onDragOver={(e) => {
                        if (e.dataTransfer.types.includes("application/x-corkboard-note")) {
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = "move";
                        }
                      }}
                      onDrop={(e) => handleNestedListDrop(e, member.id)}
                    >
                      <p className="text-[11px] font-medium uppercase tracking-wide text-black/45 dark:text-white/45">
                        Nested cluster · {member.notes.length}{" "}
                        {member.notes.length === 1 ? "note" : "notes"}
                      </p>
                      {member.notes.map((note, j) => {
                        const showNestedInsertBefore =
                          panelDrag?.target?.kind === "nested" &&
                          panelDrag.target.nestedId === member.id &&
                          panelDrag.target.insertBeforeNoteIndex === j &&
                          !(
                            panelDrag.source.kind === "nested" &&
                            panelDrag.source.nestedId === member.id &&
                            panelDrag.source.noteIndex === j
                          );
                        return (
                          <div key={note.id}>
                            {showNestedInsertBefore && (
                              <div className="mb-1.5 mx-1 h-0.5 rounded-full bg-indigo-400" />
                            )}
                            <PanelNoteCard
                              clusterId={clusterId}
                              note={note}
                              selected={selectedNoteId === note.id}
                              onSelect={() => onSelectNote(note.id)}
                              onUpdate={(update) => onUpdateNote(note.id, update)}
                              onEject={() => onEjectNote(note.id)}
                              onPushSnapshot={pushSnapshot}
                              onDragStartReorder={() => {
                                setPanelDrag({
                                  noteId: note.id,
                                  source: { kind: "nested", nestedId: member.id, noteIndex: j },
                                  target: null,
                                });
                              }}
                              onDragEnterCard={() => {
                                setPanelDrag((p) =>
                                  p
                                    ? {
                                        ...p,
                                        target: {
                                          kind: "nested",
                                          nestedId: member.id,
                                          insertBeforeNoteIndex: j,
                                        },
                                      }
                                    : null,
                                );
                              }}
                              onDragEndReorder={clearPanelDrag}
                              onDragStartGhost={(x, y) => startGhost(note, x, y)}
                              onDragMoveGhost={(x, y) => setGhostPos({ x, y })}
                              onDragEndGhost={endGhost}
                            />
                          </div>
                        );
                      })}
                      {showNestedAppendLine && (
                        <div className="mx-1 h-0.5 rounded-full bg-indigo-400" />
                      )}
                      <div
                        className="h-2 shrink-0"
                        onDragEnter={() => {
                          setPanelDrag((p) =>
                            p
                              ? {
                                  ...p,
                                  target: {
                                    kind: "nested",
                                    nestedId: member.id,
                                    insertBeforeNoteIndex: member.notes.length,
                                  },
                                }
                              : null,
                          );
                        }}
                      />
                    </div>
                  );
                }

                const note = member;
                return (
                  <div key={note.id}>
                    {showRootInsertBefore && (
                      <div className="mb-1.5 mx-1 h-0.5 rounded-full bg-indigo-400" />
                    )}
                    <PanelNoteCard
                      clusterId={clusterId}
                      note={note}
                      selected={selectedNoteId === note.id}
                      onSelect={() => onSelectNote(note.id)}
                      onUpdate={(update) => onUpdateNote(note.id, update)}
                      onEject={() => onEjectNote(note.id)}
                      onPushSnapshot={pushSnapshot}
                      onDragStartReorder={() => {
                        setPanelDrag({
                          noteId: note.id,
                          source: { kind: "root", memberIndex: i },
                          target: null,
                        });
                      }}
                      onDragEnterCard={() => {
                        setPanelDrag((p) =>
                          p
                            ? { ...p, target: { kind: "root", insertBeforeMemberIndex: i } }
                            : null,
                        );
                      }}
                      onDragEndReorder={clearPanelDrag}
                      onDragStartGhost={(x, y) => startGhost(note, x, y)}
                      onDragMoveGhost={(x, y) => setGhostPos({ x, y })}
                      onDragEndGhost={endGhost}
                    />
                  </div>
                );
              })}
              {panelDrag?.target?.kind === "root" &&
                panelDrag.target.insertBeforeMemberIndex === notes.length && (
                  <div className="mx-1 h-0.5 rounded-full bg-indigo-400" />
                )}
              <div
                className="h-3 shrink-0"
                onDragEnter={() => {
                  setPanelDrag((p) =>
                    p
                      ? { ...p, target: { kind: "root", insertBeforeMemberIndex: notes.length } }
                      : null,
                  );
                }}
              />
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
