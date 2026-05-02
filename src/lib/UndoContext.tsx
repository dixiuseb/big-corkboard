"use client";

import { createContext, useContext } from "react";

export type UndoContextValue = {
  /** Snapshot the current board state before a committed action so it can be undone. */
  pushSnapshot: () => void;
};

export const UndoContext = createContext<UndoContextValue>({
  pushSnapshot: () => {},
});

export function useUndoContext() {
  return useContext(UndoContext);
}
