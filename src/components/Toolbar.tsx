"use client";

import { useCallback } from "react";
import { Panel, useReactFlow } from "@xyflow/react";
import { DEFAULT_NOTE_COLOR } from "@/lib/noteColors";
import { useUndoContext } from "@/lib/UndoContext";

type ToolbarProps = {
  connecting: boolean;
  onToggleConnecting: () => void;
};

export function Toolbar({ connecting, onToggleConnecting }: ToolbarProps) {
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
      data: { body: "", colorKey: DEFAULT_NOTE_COLOR },
    });
  }, [addNodes, centrePosition, pushSnapshot]);

  const addCluster = useCallback(() => {
    pushSnapshot();
    addNodes({
      id: crypto.randomUUID(),
      type: "clusterNode",
      position: centrePosition(),
      data: {
        notes: [{ id: crypto.randomUUID(), body: "", colorKey: DEFAULT_NOTE_COLOR }],
        colorKey: DEFAULT_NOTE_COLOR,
      },
    });
  }, [addNodes, centrePosition, pushSnapshot]);

  return (
    <Panel position="top-center" className="m-2">
      <div className="flex items-center gap-2 rounded-xl border border-black/10 bg-white/90 px-3 py-2 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-neutral-800/90">
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

        <div className="mx-1 h-5 w-px bg-black/10 dark:bg-white/10" />

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
      </div>
    </Panel>
  );
}
