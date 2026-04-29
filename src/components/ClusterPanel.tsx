"use client";

import { useRef } from "react";
import {
  type NoteColorKey,
  NOTE_COLOR_KEYS,
  NOTE_COLOR_META,
  DEFAULT_NOTE_COLOR,
} from "@/lib/noteColors";
import type { NoteFormatting } from "@/components/NoteCard";
import type { ClusterNoteItem } from "@/components/ClusterNode";

type ClusterPanelProps = {
  clusterId: string;
  notes: ClusterNoteItem[];
  onUpdateNote: (noteId: string, update: Partial<ClusterNoteItem>) => void;
  onDeleteNote: (noteId: string) => void;
  onAddNote: () => void;
  onClose: () => void;
};

function PanelNoteCard({
  note,
  onUpdate,
  onDelete,
}: {
  note: ClusterNoteItem;
  onUpdate: (update: Partial<ClusterNoteItem>) => void;
  onDelete: () => void;
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

  const toggleFmt = (key: keyof Omit<NoteFormatting, "fontSize">) =>
    onUpdate({ formatting: { ...fmt, [key]: !fmt[key] } });

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className={`group relative rounded-lg border shadow-sm ${palette.cardClass}`}>
      {/* Mini toolbar */}
      <div className="flex items-center gap-0.5 border-b border-current/10 px-2 py-1">
        {/* Color dots */}
        {NOTE_COLOR_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            title={NOTE_COLOR_META[key].label}
            onClick={() => onUpdate({ colorKey: key })}
            className={`h-4 w-4 rounded-sm transition-transform hover:scale-110 ${NOTE_COLOR_META[key].swatch} ${colorKey === key ? "ring-1 ring-black/30 ring-offset-1" : ""}`}
          />
        ))}
        <div className="mx-1 h-3.5 w-px bg-current/15" />
        {/* B / I / U */}
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
            className={`flex h-5 w-5 items-center justify-center rounded text-xs transition-colors ${cls} ${fmt[key] ? "bg-black/10 text-black" : "text-current/40 hover:bg-black/5 hover:text-current/80"}`}
          >
            {label}
          </button>
        ))}
        <div className="flex-1" />
        {/* Delete */}
        <button
          type="button"
          title="Remove note"
          onClick={onDelete}
          className="flex h-5 w-5 items-center justify-center rounded text-current/30 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <textarea
        ref={textareaRef}
        value={note.body}
        onChange={(e) => onUpdate({ body: e.target.value })}
        onWheel={(e) => e.stopPropagation()}
        placeholder="Note…"
        rows={3}
        className={`w-full resize-y bg-transparent px-3 py-2 text-sm outline-none placeholder:text-current/30 ${fmtClasses}`}
        spellCheck
      />
    </div>
  );
}

export function ClusterPanel({
  notes,
  onUpdateNote,
  onDeleteNote,
  onAddNote,
  onClose,
}: ClusterPanelProps) {
  return (
    <div className="pointer-events-none fixed inset-y-0 right-0 z-50 flex w-80 flex-col">
      <div className="pointer-events-auto flex h-full flex-col rounded-l-2xl border-l border-y border-black/10 bg-white shadow-2xl">
        {/* Panel header */}
        <div className="flex items-center justify-between border-b border-black/8 px-4 py-3">
          <h2 className="text-sm font-semibold text-black/70">Cluster notes</h2>
          <button
            type="button"
            title="Collapse cluster"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-black/40 transition-colors hover:bg-black/5 hover:text-black"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Notes list */}
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {notes.length === 0 ? (
            <p className="text-center text-sm text-black/30 pt-8">No notes yet</p>
          ) : (
            notes.map((note) => (
              <PanelNoteCard
                key={note.id}
                note={note}
                onUpdate={(update) => onUpdateNote(note.id, update)}
                onDelete={() => onDeleteNote(note.id)}
              />
            ))
          )}
        </div>

        {/* Add note button */}
        <div className="border-t border-black/8 px-4 py-3">
          <button
            type="button"
            onClick={onAddNote}
            className="w-full rounded-lg border border-dashed border-black/20 py-2 text-sm text-black/40 transition-colors hover:border-black/30 hover:text-black/60"
          >
            + Add note
          </button>
        </div>
      </div>
    </div>
  );
}
