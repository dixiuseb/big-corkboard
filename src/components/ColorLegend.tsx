"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  NOTE_COLOR_KEYS,
  NOTE_COLOR_META,
  type NoteColorKey,
} from "@/lib/noteColors";
import type { BoardColorLabels } from "@/lib/persistence";

type Props = {
  colorLabels: BoardColorLabels;
  onUpdateLabel: (key: NoteColorKey, label: string | null) => void;
};

export function ColorLegend({ colorLabels, onUpdateLabel }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [editKey, setEditKey] = useState<NoteColorKey | null>(null);
  const [draft, setDraft] = useState("");
  const [pickKey, setPickKey] = useState<NoteColorKey | null>(null);
  const addRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLDivElement>(null);

  const labeledKeys = NOTE_COLOR_KEYS.filter((k) => (colorLabels[k] ?? "").trim().length > 0);
  const unlabeledKeys = NOTE_COLOR_KEYS.filter((k) => !(colorLabels[k] ?? "").trim().length);

  const closeAll = useCallback(() => {
    setAddOpen(false);
    setEditKey(null);
    setPickKey(null);
    setDraft("");
  }, []);

  useEffect(() => {
    if (!addOpen && editKey === null) return;
    const down = (e: MouseEvent) => {
      const t = e.target as Node;
      if (addRef.current?.contains(t) || editRef.current?.contains(t)) return;
      closeAll();
    };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [addOpen, editKey, closeAll]);

  const startEdit = (key: NoteColorKey) => {
    setEditKey(key);
    setDraft(colorLabels[key] ?? "");
    setAddOpen(false);
    setPickKey(null);
  };

  const commitDraft = () => {
    if (pickKey !== null) {
      const v = draft.trim();
      if (v) onUpdateLabel(pickKey, v);
      closeAll();
      return;
    }
    if (editKey !== null) {
      const v = draft.trim();
      if (v) onUpdateLabel(editKey, v);
      else onUpdateLabel(editKey, null);
      closeAll();
    }
  };

  const clearEditKey = () => {
    if (editKey) onUpdateLabel(editKey, null);
    closeAll();
  };

  return (
    <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-t border-black/10 bg-neutral-50 px-3 py-2 dark:border-white/10 dark:bg-neutral-950">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400 dark:text-neutral-500">
        Categories
      </span>
      {labeledKeys.map((key) => (
        <div key={key} className="relative">
          <button
            type="button"
            onClick={() => startEdit(key)}
            className="inline-flex max-w-[140px] items-center gap-1.5 rounded-full border border-black/10 bg-white py-0.5 pl-0.5 pr-2 text-xs text-stone-700 shadow-sm transition-colors hover:border-black/20 hover:bg-stone-50 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-800/80"
            title="Click to rename or remove"
          >
            <span className={`h-5 w-5 flex-shrink-0 rounded-full border border-black/10 ${NOTE_COLOR_META[key].swatch}`} />
            <span className="truncate font-medium">{colorLabels[key]}</span>
          </button>
          {editKey === key && (
            <div
              ref={editRef}
              className="absolute bottom-full left-0 z-[60] mb-1 w-56 rounded-lg border border-black/10 bg-white p-3 shadow-xl dark:border-white/10 dark:bg-neutral-800"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <label className="text-[11px] font-medium text-stone-500 dark:text-neutral-400">
                Rename ({NOTE_COLOR_META[key].label})
              </label>
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitDraft();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    closeAll();
                  }
                }}
                className="mt-1.5 w-full rounded-md border border-black/15 bg-white px-2 py-1.5 text-sm text-stone-800 outline-none focus:border-indigo-400 dark:border-white/15 dark:bg-neutral-900 dark:text-neutral-100"
                placeholder="Category name"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={commitDraft}
                  className="flex-1 rounded-md bg-indigo-600 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={closeAll}
                  className="rounded-md border border-black/15 px-2 py-1.5 text-xs text-stone-600 hover:bg-black/5 dark:border-white/15 dark:text-neutral-300 dark:hover:bg-white/10"
                >
                  Cancel
                </button>
              </div>
              <button
                type="button"
                onClick={clearEditKey}
                className="mt-2 w-full text-left text-xs text-red-500 hover:underline dark:text-red-400"
              >
                Remove label
              </button>
            </div>
          )}
        </div>
      ))}

      {unlabeledKeys.length > 0 && (
        <div className="relative" ref={addRef}>
          <button
            type="button"
            onClick={() => {
              setAddOpen((v) => !v);
              setEditKey(null);
              setPickKey(null);
              setDraft("");
            }}
            className="rounded-full border border-dashed border-black/25 px-2.5 py-1 text-xs font-medium text-stone-500 transition-colors hover:border-black/40 hover:bg-white hover:text-stone-700 dark:border-white/20 dark:text-neutral-400 dark:hover:border-white/35 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            + Category
          </button>
          {addOpen && (
            <div
              className="absolute bottom-full left-0 z-[60] mb-1 w-56 rounded-lg border border-black/10 bg-white py-2 shadow-xl dark:border-white/10 dark:bg-neutral-800"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {pickKey === null ? (
                <>
                  <div className="px-3 pb-1 text-[11px] font-medium text-stone-500 dark:text-neutral-400">
                    Choose a color
                  </div>
                  <div className="max-h-48 overflow-y-auto py-1">
                    {unlabeledKeys.map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setPickKey(key);
                          setDraft("");
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-stone-700 hover:bg-black/5 dark:text-neutral-200 dark:hover:bg-white/8"
                      >
                        <span className={`h-5 w-5 flex-shrink-0 rounded-full border border-black/10 ${NOTE_COLOR_META[key].swatch}`} />
                        <span>{NOTE_COLOR_META[key].label}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="px-3 pb-1">
                  <button
                    type="button"
                    onClick={() => setPickKey(null)}
                    className="mb-2 text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    ← Back
                  </button>
                  <div className="flex items-center gap-2 pb-1">
                    <span className={`h-5 w-5 flex-shrink-0 rounded-full border border-black/10 ${NOTE_COLOR_META[pickKey].swatch}`} />
                    <span className="text-sm font-medium text-stone-800 dark:text-neutral-100">
                      Name this category
                    </span>
                  </div>
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitDraft();
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        closeAll();
                      }
                    }}
                    className="mt-1 w-full rounded-md border border-black/15 bg-white px-2 py-1.5 text-sm outline-none focus:border-indigo-400 dark:border-white/15 dark:bg-neutral-900 dark:text-neutral-100"
                    placeholder="e.g. Characters"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={commitDraft}
                      disabled={!draft.trim()}
                      className="flex-1 rounded-md bg-indigo-600 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={closeAll}
                      className="rounded-md border border-black/15 px-2 py-1.5 text-xs text-stone-600 dark:border-white/15 dark:text-neutral-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
