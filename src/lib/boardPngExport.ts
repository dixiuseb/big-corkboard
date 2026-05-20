import { toPng } from "html-to-image";
import type { ReactFlowInstance } from "@xyflow/react";

export type BoardPngExportMode = "viewport" | "fitAll";

/** Strip characters unsafe in filenames; collapse whitespace. */
export function sanitizeBoardFilename(title: string): string {
  const cleaned = title
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return cleaned.length > 0 ? cleaned : "Board";
}

/** Base name without extension: `{title} {ISO timestamp}` (ms resolution, filename-safe). */
export function boardPngBasename(title: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${sanitizeBoardFilename(title)} ${stamp}`;
}

function shouldIncludeDomNode(node: unknown): boolean {
  if (!(node instanceof HTMLElement)) return true;
  if (node.classList.contains("react-flow__panel")) return false;
  if (node.classList.contains("react-flow__controls")) return false;
  if (node.classList.contains("react-flow__minimap")) return false;
  if (node.classList.contains("react-flow__attribution")) return false;
  return true;
}

type FlowPick = Pick<ReactFlowInstance, "fitView" | "getViewport" | "setViewport" | "getNodes">;

/**
 * Rasterizes the React Flow root (canvas + edges + background), excluding
 * built-in panels, controls, and minimap. For `fitAll`, temporarily fits the
 * view to all nodes then restores the previous viewport after capture.
 */
export async function exportBoardFlowPng(
  flowElement: HTMLElement,
  boardTitle: string,
  mode: BoardPngExportMode,
  rf: FlowPick,
): Promise<void> {
  const prev = rf.getViewport();
  try {
    if (mode === "fitAll" && rf.getNodes().length > 0) {
      await rf.fitView({
        padding: 0.15,
        duration: 0,
        maxZoom: 1.5,
        minZoom: 0.1,
      });
    }
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });

    const dataUrl = await toPng(flowElement, {
      pixelRatio: 2,
      cacheBust: true,
      filter: shouldIncludeDomNode,
    });

    const base = boardPngBasename(boardTitle);
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${base}.png`;
    a.rel = "noopener";
    a.click();
  } finally {
    if (mode === "fitAll") {
      await rf.setViewport(prev, { duration: 0 });
    }
  }
}
