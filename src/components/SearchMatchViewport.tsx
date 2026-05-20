"use client";

import { useEffect, useRef } from "react";
import { useReactFlow, useStore } from "@xyflow/react";
import type { SearchMatch } from "@/lib/searchMatches";

type Props = {
  open: boolean;
  debouncedQuery: string;
  matches: SearchMatch[];
  activeIndex: number;
  /** Expand cluster + select panel note (Board-owned). */
  onClusterInternalActive: (clusterId: string, noteId: string) => void;
  /** Collapse all clusters (canvas-only active match). */
  onCollapseClusters: () => void;
};

/**
 * When the active search match changes, expand cluster / select panel row as needed
 * and pan/zoom the viewport to the target node.
 */
export function SearchMatchViewport({
  open,
  debouncedQuery,
  matches,
  activeIndex,
  onClusterInternalActive,
  onCollapseClusters,
}: Props) {
  const { fitView, getNodesBounds, getViewport } = useReactFlow();
  const width = useStore((s) => s.width);
  const height = useStore((s) => s.height);
  const prevSig = useRef<string>("");

  useEffect(() => {
    if (!open || debouncedQuery.trim().length < 1 || matches.length === 0) {
      prevSig.current = "";
      return;
    }

    const safeIdx = Math.min(activeIndex, matches.length - 1);
    const m = matches[safeIdx];
    const sig = `${safeIdx}-${m.kind}-${m.kind === "canvas" ? m.nodeId : `${m.clusterId}:${m.noteId}`}`;
    if (sig === prevSig.current) return;
    prevSig.current = sig;

    if (m.kind === "cluster") {
      onClusterInternalActive(m.clusterId, m.noteId);
    } else {
      onCollapseClusters();
    }

    const targetId = m.kind === "canvas" ? m.nodeId : m.clusterId;

    const run = () => {
      const vp = getViewport();
      let bounds;
      try {
        bounds = getNodesBounds([targetId]);
      } catch {
        return;
      }
      if (!bounds.width && !bounds.height) return;

      const pad = 48;
      const visibleW = width / vp.zoom;
      const visibleH = height / vp.zoom;
      const minX = -vp.x / vp.zoom;
      const minY = -vp.y / vp.zoom;
      const maxX = minX + visibleW;
      const maxY = minY + visibleH;

      const fullyInside =
        bounds.x >= minX - pad &&
        bounds.y >= minY - pad &&
        bounds.x + bounds.width <= maxX + pad &&
        bounds.y + bounds.height <= maxY + pad;

      const minReadableZoom = 0.82;
      const needsZoom = vp.zoom < minReadableZoom;

      if (fullyInside && !needsZoom) return;

      void fitView({
        nodes: [{ id: targetId }],
        padding: 0.22,
        duration: 320,
        maxZoom: 1.35,
        minZoom: 0.15,
      });
    };

    requestAnimationFrame(() => requestAnimationFrame(run));
  }, [
    open,
    debouncedQuery,
    matches,
    activeIndex,
    fitView,
    getNodesBounds,
    getViewport,
    width,
    height,
    onClusterInternalActive,
    onCollapseClusters,
  ]);

  return null;
}
