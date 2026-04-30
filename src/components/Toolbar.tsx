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
      <div className="flex items-center gap-2 rounded-xl border border-[var(--foreground)]/15 bg-[var(--background)]/90 px-3 py-2 shadow-lg backdrop-blur-md">
        <button
          type="button"
          onClick={addNote}
          className="rounded-lg bg-[var(--foreground)] px-3 py-1.5 text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-80"
        >
          Add note
        </button>
        <button
          type="button"
          onClick={addCluster}
          className="rounded-lg border border-[var(--foreground)]/20 px-3 py-1.5 text-sm font-medium text-[var(--foreground)]/70 transition-colors hover:border-[var(--foreground)]/40 hover:text-[var(--foreground)]"
        >
          Add cluster
        </button>
      </div>
    </Panel>
  );
}
