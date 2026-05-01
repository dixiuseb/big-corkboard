"use client";

import { useCallback, useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getStraightPath,
  useReactFlow,
  type EdgeProps,
  type Edge,
} from "@xyflow/react";

export type EdgeDirection = "none" | "forward" | "reverse" | "both";

export type BoardEdgeData = {
  direction: EdgeDirection;
  label?: string;
};

export type BoardEdgeType = Edge<BoardEdgeData, "boardEdge">;

const ARROW_SIZE = 10;

// Filled arrowhead triangle pointing from (fromX,fromY) toward (toX,toY); tip at (toX,toY).
function arrowheadPath(fromX: number, fromY: number, toX: number, toY: number): string {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const lx = toX - ARROW_SIZE * Math.cos(angle - Math.PI / 6);
  const ly = toY - ARROW_SIZE * Math.sin(angle - Math.PI / 6);
  const rx = toX - ARROW_SIZE * Math.cos(angle + Math.PI / 6);
  const ry = toY - ARROW_SIZE * Math.sin(angle + Math.PI / 6);
  return `M${lx},${ly} L${toX},${toY} L${rx},${ry} Z`;
}

// Pull a point ARROW_SIZE back from (toX,toY) along the (from→to) direction,
// so the line stops at the arrowhead base and doesn't poke through the tip.
function shortenedEnd(fromX: number, fromY: number, toX: number, toY: number): [number, number] {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  return [toX - ARROW_SIZE * Math.cos(angle), toY - ARROW_SIZE * Math.sin(angle)];
}

export function BoardEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected,
}: EdgeProps<BoardEdgeType>) {
  const { updateEdgeData } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data?.label ?? "");


  const stroke = selected ? "#818cf8" : "#64748b";
  const opacity = selected ? 1 : 0.7;
  const direction = data?.direction ?? "none";

  const hasEnd   = direction === "forward" || direction === "both";
  const hasStart = direction === "reverse"  || direction === "both";

  // Shorten line endpoints so they stop at the arrowhead base, not the tip.
  // This prevents the blunt line terminus from poking through the filled triangle.
  const [adjTX, adjTY] = hasEnd   ? shortenedEnd(sourceX, sourceY, targetX, targetY) : [targetX, targetY];
  const [adjSX, adjSY] = hasStart ? shortenedEnd(targetX, targetY, sourceX, sourceY) : [sourceX, sourceY];

  const [edgePath] = getStraightPath({ sourceX: adjSX, sourceY: adjSY, targetX: adjTX, targetY: adjTY });

  // Keep the label at the midpoint of the original (full-length) line.
  const labelX = (sourceX + targetX) / 2;
  const labelY = (sourceY + targetY) / 2;

  const endArrow   = hasEnd   ? arrowheadPath(sourceX, sourceY, targetX, targetY) : null;
  const startArrow = hasStart ? arrowheadPath(targetX, targetY, sourceX, sourceY) : null;

  const commitLabel = useCallback(() => {
    setEditing(false);
    updateEdgeData(id, { label: draft.trim() || undefined });
  }, [id, draft, updateEdgeData]);

  return (
    <>
      {/* Single <g> for opacity so the line and arrowhead fade as a unit —
          no double-dark where they overlap. */}
      <g opacity={opacity}>
        <BaseEdge
          id={id}
          path={edgePath}
          style={{ strokeWidth: selected ? 2.5 : 1.5, stroke }}
        />
        {endArrow   && <path d={endArrow}   fill={stroke} stroke="none" />}
        {startArrow && <path d={startArrow} fill={stroke} stroke="none" />}
      </g>

      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan"
        >
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") {
                  e.preventDefault();
                  commitLabel();
                }
              }}
              placeholder="Label…"
              className="w-32 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs shadow-sm outline-none focus:border-indigo-400 dark:border-neutral-600 dark:bg-neutral-800 dark:text-white dark:focus:border-indigo-500"
            />
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDraft(data?.label ?? "");
                setEditing(true);
              }}
              className={`rounded px-1.5 py-0.5 text-xs transition-opacity ${
                data?.label
                  ? "border border-slate-200 bg-white shadow-sm text-slate-600 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                  : selected
                    ? "text-slate-400 opacity-60 hover:opacity-100 dark:text-neutral-500"
                    : "pointer-events-none opacity-0"
              }`}
            >
              {data?.label ?? "label…"}
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
