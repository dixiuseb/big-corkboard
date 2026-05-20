"use client";

import { useCallback, useEffect, useRef } from "react";
import { Panel } from "@xyflow/react";

type Props = {
  open: boolean;
  inputValue: string;
  onInputChange: (v: string) => void;
  onClose: () => void;
  matchesLength: number;
  activeIndex: number;
  onNext: () => void;
  onPrev: () => void;
  debouncedQuery: string;
};

export function BoardSearchBar({
  open,
  inputValue,
  onInputChange,
  onClose,
  matchesLength,
  activeIndex,
  onNext,
  onPrev,
  debouncedQuery,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const counterLabel =
    debouncedQuery.length < 1
      ? ""
      : matchesLength === 0
        ? "No matches"
        : matchesLength === 1
          ? "1 match"
          : `${activeIndex + 1} / ${matchesLength} matches`;

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        onNext();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        onPrev();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) onPrev();
        else onNext();
      }
    },
    [onNext, onPrev],
  );

  if (!open) return null;

  return (
    <Panel
      position="top-center"
      className="!m-0 flex w-full max-w-lg justify-center px-4 pt-1"
    >
      <div
        className="flex w-full max-w-md items-center gap-2 rounded-xl border border-black/10 bg-white/95 px-2 py-1.5 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-neutral-900/95"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="search"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search notes…"
          aria-label="Search notes on this board"
          className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-2 py-1 text-sm text-stone-800 outline-none focus:border-indigo-400 dark:border-white/15 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-indigo-500"
        />
        <span className="shrink-0 whitespace-nowrap text-xs text-stone-500 tabular-nums dark:text-neutral-400">
          {counterLabel}
        </span>
        <button
          type="button"
          title="Previous match (Shift+Enter)"
          onClick={onPrev}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-stone-600 hover:bg-black/5 dark:text-neutral-300 dark:hover:bg-white/10"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <button
          type="button"
          title="Next match (Enter)"
          onClick={onNext}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-stone-600 hover:bg-black/5 dark:text-neutral-300 dark:hover:bg-white/10"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
        <button
          type="button"
          title="Close search (Escape)"
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-stone-500 hover:bg-black/5 hover:text-stone-800 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <span className="text-lg leading-none">×</span>
        </button>
      </div>
    </Panel>
  );
}
