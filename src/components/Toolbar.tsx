"use client";

import { useCallback } from "react";
import { Panel, useReactFlow } from "@xyflow/react";
import { DEFAULT_NOTE_COLOR } from "@/lib/noteColors";

export function Toolbar() {
  const { addNodes, screenToFlowPosition } = useReactFlow();

  const centrePosition = useCallback(
    () =>
      screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      }),
    [screenToFlowPosition],
  );

  const addNote = useCallback(() => {
    addNodes({
      id: crypto.randomUUID(),
      type: "noteCard",
      position: centrePosition(),
      data: { body: "", colorKey: DEFAULT_NOTE_COLOR },
    });
  }, [addNodes, centrePosition]);

  const addCluster = useCallback(() => {
    addNodes({
      id: crypto.randomUUID(),
      type: "clusterNode",
      position: centrePosition(),
      data: {
        notes: [{ id: crypto.randomUUID(), body: "", colorKey: DEFAULT_NOTE_COLOR }],
        colorKey: DEFAULT_NOTE_COLOR,
      },
    });
  }, [addNodes, centrePosition]);

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
      </div>
    </Panel>
  );
}
