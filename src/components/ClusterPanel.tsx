"use client";

import { useRef, useState } from "react";
import {
  type NoteColorKey,
  NOTE_COLOR_KEYS,
  NOTE_COLOR_META,
  DEFAULT_NOTE_COLOR,
} from "@/lib/noteColors";
import type { NoteFormatting } from "@/components/NoteCard";
import type { ClusterNoteItem } from "@/components/ClusterNode";
import { useUndoContext } from "@/lib/UndoContext";

type ClusterPanelProps = {
  clusterId: string;
  notes: ClusterNoteItem[];
  onUpdateNote: (noteId: string, update: Partial<ClusterNoteItem>) => void;
  onDeleteNote: (noteId: string) => void;
  onAddNote: () => void;
  onClose: () => void;
  onDeleteCluster: () => void;
  onUncluster: () => void;
};

function PanelNoteCard({
  note,
  selected,
  onSelect,
  onUpdate,
  onDelete,
  onPushSnapshot,
}: {
  note: ClusterNoteItem;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (update: Partial<ClusterNoteItem>) => void;
  onDelete: () => void;
  onPushSnapshot: () => void;
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
      className={`group relative cursor-pointer rounded-lg border shadow-sm transition-shadow ${palette.cardClass} ${selected ? `ring-2 ring-offset-1 ${palette.selectedRing}` : "ring-0"}`}
    >
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
        title="Remove note"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded text-current/30 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

export function ClusterPanel({
  notes,
  onUpdateNote,
  onDeleteNote,
  onAddNote,
  onClose,
  onDeleteCluster,
  onUncluster,
}: ClusterPanelProps) {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { pushSnapshot } = useUndoContext();

  const selectedNote = notes.find((n) => n.id === selectedNoteId) ?? null;
  const fmt = selectedNote?.formatting ?? {};
  const colorKey = selectedNote?.colorKey ?? DEFAULT_NOTE_COLOR;

  const toggleFmt = (key: keyof Omit<NoteFormatting, "fontSize">) => {
    if (!selectedNote) return;
    pushSnapshot();
    onUpdateNote(selectedNote.id, {
      formatting: { ...fmt, [key]: !fmt[key] },
    });
  };

  const setColor = (key: NoteColorKey) => {
    if (!selectedNote) return;
    pushSnapshot();
    onUpdateNote(selectedNote.id, { colorKey: key });
  };

  return (
    <div className="pointer-events-none fixed bottom-9 right-0 top-0 z-50 flex w-80 flex-col">
      <div className="pointer-events-auto flex h-full flex-col rounded-l-2xl border-y border-l border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-neutral-900">

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

        {/* Note formatting toolbar — active when a note is selected */}
        <div className={`border-b border-black/8 px-3 py-2 transition-opacity dark:border-white/8 ${selectedNote ? "opacity-100" : "pointer-events-none opacity-30"}`}>
          <div className="flex items-center gap-1">
            {NOTE_COLOR_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                title={NOTE_COLOR_META[key].label}
                onClick={() => setColor(key)}
                className={`h-5 w-5 rounded transition-transform hover:scale-110 ${NOTE_COLOR_META[key].swatch} ${colorKey === key ? "ring-1 ring-black/30 ring-offset-1" : ""}`}
              />
            ))}
            <div className="mx-1 h-4 w-px bg-black/10 dark:bg-white/10" />
            {(
              [
                { key: "bold" as const, label: "B", cls: "font-bold" },
                { key: "italic" as const, label: "I", cls: "italic" },
                { key: "underline" as const, label: "U", cls: "underline" },
              ]
            ).map(({ key, label, cls }) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleFmt(key)}
                aria-pressed={!!fmt[key]}
                className={`flex h-6 w-6 items-center justify-center rounded text-xs transition-colors ${cls} ${fmt[key] ? "bg-black/10 text-black dark:bg-white/15 dark:text-white" : "text-black/40 hover:bg-black/5 hover:text-black dark:text-white/40 dark:hover:bg-white/8 dark:hover:text-white"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes list */}
        <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
          {notes.length === 0 ? (
            <p className="pt-8 text-center text-sm text-black/30 dark:text-white/30">No notes yet</p>
          ) : (
            notes.map((note) => (
              <PanelNoteCard
                key={note.id}
                note={note}
                selected={selectedNoteId === note.id}
                onSelect={() => setSelectedNoteId(note.id)}
                onUpdate={(update) => onUpdateNote(note.id, update)}
                onDelete={() => onDeleteNote(note.id)}
                onPushSnapshot={pushSnapshot}
              />
            ))
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
  );
}
