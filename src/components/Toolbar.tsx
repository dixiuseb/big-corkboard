"use client";

import { useCallback } from "react";
import { Panel, useReactFlow } from "@xyflow/react";
import { DEFAULT_NOTE_COLOR } from "@/lib/noteColors";

export function Toolbar() {
  const { addNodes, screenToFlowPosition } = useReactFlow();

  const addNote = useCallback(() => {
    const position = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });

    addNodes({
      id: crypto.randomUUID(),
      type: "noteCard",
      position,
      data: {
        body: "",
        colorKey: DEFAULT_NOTE_COLOR,
      },
    });
  }, [addNodes, screenToFlowPosition]);

  return (
    <Panel position="top-center" className="m-2">
      <div className="flex items-center gap-2 rounded-xl border border-[var(--foreground)]/15 bg-[var(--background)]/90 px-3 py-2 shadow-lg backdrop-blur-md">
        <button
          type="button"
          onClick={addNote}
          className="rounded-lg bg-[var(--foreground)] px-3 py-1.5 text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-90"
        >
          Add note
        </button>
      </div>
    </Panel>
  );
}
