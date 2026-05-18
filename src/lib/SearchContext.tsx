"use client";

import { createContext, useContext } from "react";
import type { SearchMatch } from "@/lib/searchMatches";

export type SearchSessionValue = {
  /** Search bar is open (session active). */
  open: boolean;
  /** Debounced lowercase query; length ≥ 1 enables match UI. */
  debouncedQuery: string;
  /** Ordered matches for cycling. */
  matches: SearchMatch[];
  /** Current index into `matches` (0-based). */
  activeIndex: number;
  /** True when match UI should dim non-hits (≥1 match and query active). */
  dimNonMatches: boolean;
  /** Canvas note id is the active cycle stop. */
  isActiveCanvasMatch: (nodeId: string) => boolean;
  /** Canvas note matches query but is not the active stop. */
  isPassiveCanvasMatch: (nodeId: string) => boolean;
  /** Cluster has ≥1 matching internal note. */
  clusterHasPassiveOrActiveMatch: (clusterId: string) => boolean;
  /** This cluster-internal note is the active cycle stop. */
  isActiveClusterNoteMatch: (clusterId: string, noteId: string) => boolean;
  /** This cluster-internal note matches but is not the active stop. */
  isPassiveClusterNoteMatch: (clusterId: string, noteId: string) => boolean;
};

const defaultSearchSession: SearchSessionValue = {
  open: false,
  debouncedQuery: "",
  matches: [],
  activeIndex: 0,
  dimNonMatches: false,
  isActiveCanvasMatch: () => false,
  isPassiveCanvasMatch: () => false,
  clusterHasPassiveOrActiveMatch: () => false,
  isActiveClusterNoteMatch: () => false,
  isPassiveClusterNoteMatch: () => false,
};

export const SearchContext = createContext<SearchSessionValue>(defaultSearchSession);

export function useSearchSession(): SearchSessionValue {
  return useContext(SearchContext);
}

export function buildSearchSessionValue(
  open: boolean,
  debouncedQuery: string,
  matches: SearchMatch[],
  activeIndex: number,
): SearchSessionValue {
  const q = debouncedQuery.trim().toLowerCase();
  const dimNonMatches = open && q.length >= 1 && matches.length > 0;
  const safeIndex = matches.length > 0 ? Math.min(activeIndex, matches.length - 1) : 0;
  const active = matches.length > 0 ? matches[safeIndex] : undefined;

  const isActiveCanvasMatch = (nodeId: string) =>
    !!active && active.kind === "canvas" && active.nodeId === nodeId;

  const isPassiveCanvasMatch = (nodeId: string) =>
    dimNonMatches &&
    matches.some((m) => m.kind === "canvas" && m.nodeId === nodeId) &&
    !(active?.kind === "canvas" && active.nodeId === nodeId);

  const clusterHasPassiveOrActiveMatch = (clusterId: string) =>
    dimNonMatches &&
    matches.some((m) => m.kind === "cluster" && m.clusterId === clusterId);

  const isActiveClusterNoteMatch = (clusterId: string, noteId: string) =>
    !!active &&
    active.kind === "cluster" &&
    active.clusterId === clusterId &&
    active.noteId === noteId;

  const isPassiveClusterNoteMatch = (clusterId: string, noteId: string) =>
    dimNonMatches &&
    matches.some(
      (m) => m.kind === "cluster" && m.clusterId === clusterId && m.noteId === noteId,
    ) &&
    !(active?.kind === "cluster" && active.clusterId === clusterId && active.noteId === noteId);

  return {
    open,
    debouncedQuery: q,
    matches,
    activeIndex: safeIndex,
    dimNonMatches,
    isActiveCanvasMatch,
    isPassiveCanvasMatch,
    clusterHasPassiveOrActiveMatch,
    isActiveClusterNoteMatch,
    isPassiveClusterNoteMatch,
  };
}
