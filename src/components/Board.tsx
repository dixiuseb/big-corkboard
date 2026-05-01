"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  ConnectionMode,
  ConnectionLineType,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  type XYPosition,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import NoteCard, { type NoteFlowNode } from "@/components/NoteCard";
import ClusterNode, {
  type ClusterFlowNode,
  type ClusterNoteItem,
} from "@/components/ClusterNode";
import { BoardEdge, type BoardEdgeType, type EdgeDirection } from "@/components/BoardEdge";
import { ClusterPanel } from "@/components/ClusterPanel";
import { Toolbar } from "@/components/Toolbar";
import { DEFAULT_NOTE_COLOR } from "@/lib/noteColors";

type BoardNode = NoteFlowNode | ClusterFlowNode;

type ContextMenu = { edgeId: string; x: number; y: number };

const DIRECTION_CYCLE: EdgeDirection[] = ["none", "forward", "reverse", "both"];

const initialNodes: BoardNode[] = [];
const initialEdges: BoardEdgeType[] = [];

export function Board() {
  const [nodes, setNodes, onNodesChange] = useNodesState<BoardNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<BoardEdgeType>(initialEdges);

  // Always-fresh ref so drag callbacks don't capture stale node lists.
  const nodesRef = useRef(nodes);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  // ── Drag-to-pin state ─────────────────────────────────────────────────────
  const prevDropTargetRef = useRef<string | null>(null);
  const dragStartPositionRef = useRef<XYPosition | null>(null);

  // ── Connection mode ────────────────────────────────────────────────────────
  const [connecting, setConnecting] = useState(false);
  const toggleConnecting = useCallback(() => setConnecting((v) => !v), []);

  // nodeTypes must be stable across renders to avoid React Flow remounting nodes.
  const nodeTypes = useMemo(() => ({ noteCard: NoteCard, clusterNode: ClusterNode }), []);
  const edgeTypes = useMemo(() => ({ boardEdge: BoardEdge }), []);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          { ...params, type: "boardEdge", data: { direction: "none" } },
          eds,
        ) as BoardEdgeType[],
      ),
    [setEdges],
  );

  // ── Context menu (edge right-click) ───────────────────────────────────────
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);

  const onEdgeContextMenu = useCallback((e: React.MouseEvent, edge: Edge) => {
    e.preventDefault();
    setContextMenu({ edgeId: edge.id, x: e.clientX, y: e.clientY });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const setEdgeDirection = useCallback((edgeId: string, direction: EdgeDirection) => {
    setEdges((eds) =>
      eds.map((e) =>
        e.id === edgeId
          ? { ...e, data: { ...(e.data as BoardEdgeType["data"]), direction } }
          : e,
      ) as BoardEdgeType[],
    );
    closeContextMenu();
  }, [setEdges, closeContextMenu]);

  const deleteEdge = useCallback((edgeId: string) => {
    setEdges((eds) => eds.filter((e) => e.id !== edgeId) as BoardEdgeType[]);
    closeContextMenu();
  }, [setEdges, closeContextMenu]);

  // ── Keyboard: Escape exits connection mode; Backspace deletes selected edges
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setConnecting(false);
        setContextMenu(null);
        return;
      }
      if (e.key === "Backspace") {
        const active = document.activeElement;
        if (active?.tagName === "INPUT" || active?.tagName === "TEXTAREA") return;
        setEdges((eds) => eds.filter((edge) => !edge.selected) as BoardEdgeType[]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setEdges]);

  // ── Cluster panel state ────────────────────────────────────────────────────
  const expandedCluster = useMemo(
    () => nodes.find((n): n is ClusterFlowNode => n.type === "clusterNode" && !!n.data.expanded) ?? null,
    [nodes],
  );

  const updateClusterNodes = useCallback(
    (id: string, updater: (n: ClusterFlowNode) => ClusterFlowNode) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === id && n.type === "clusterNode" ? updater(n as ClusterFlowNode) : n)),
      );
    },
    [setNodes],
  );

  const handleClosePanel = useCallback(() => {
    if (!expandedCluster) return;
    updateClusterNodes(expandedCluster.id, (n) => ({
      ...n,
      data: { ...n.data, expanded: false },
    }));
  }, [expandedCluster, updateClusterNodes]);

  const handleUpdateNote = useCallback(
    (noteId: string, update: Partial<ClusterNoteItem>) => {
      if (!expandedCluster) return;
      updateClusterNodes(expandedCluster.id, (n) => ({
        ...n,
        data: {
          ...n.data,
          notes: n.data.notes.map((note) =>
            note.id === noteId ? { ...note, ...update } : note,
          ),
          colorKey: n.data.notes[0]?.id === noteId
            ? (update.colorKey ?? n.data.colorKey)
            : n.data.colorKey,
        },
      }));
    },
    [expandedCluster, updateClusterNodes],
  );

  const handleDeleteNote = useCallback(
    (noteId: string) => {
      if (!expandedCluster) return;
      const remaining = expandedCluster.data.notes.filter((n) => n.id !== noteId);
      if (remaining.length === 0) {
        setNodes((nds) => nds.filter((n) => n.id !== expandedCluster.id));
      } else {
        updateClusterNodes(expandedCluster.id, (n) => ({
          ...n,
          data: { ...n.data, notes: remaining },
        }));
      }
    },
    [expandedCluster, setNodes, updateClusterNodes],
  );

  const handleDeleteCluster = useCallback(() => {
    if (!expandedCluster) return;
    setNodes((nds) => nds.filter((n) => n.id !== expandedCluster.id));
  }, [expandedCluster, setNodes]);

  const handleUncluster = useCallback(() => {
    if (!expandedCluster) return;
    const { position, data } = expandedCluster;
    const looseNotes: NoteFlowNode[] = data.notes.map((note, i) => ({
      id: crypto.randomUUID(),
      type: "noteCard" as const,
      position: { x: position.x + i * 30, y: position.y + i * 30 },
      data: {
        body: note.body,
        colorKey: note.colorKey,
        formatting: note.formatting,
      },
    }));
    setNodes((nds) => [
      ...nds.filter((n) => n.id !== expandedCluster.id),
      ...looseNotes,
    ]);
  }, [expandedCluster, setNodes]);

  const handleAddNote = useCallback(() => {
    if (!expandedCluster) return;
    const newNote: ClusterNoteItem = {
      id: crypto.randomUUID(),
      body: "",
      colorKey: expandedCluster.data.colorKey ?? DEFAULT_NOTE_COLOR,
    };
    updateClusterNodes(expandedCluster.id, (n) => ({
      ...n,
      data: { ...n.data, notes: [...n.data.notes, newNote] },
    }));
  }, [expandedCluster, updateClusterNodes]);

  // ── Drag-to-pin handlers ──────────────────────────────────────────────────

  const onNodeDragStart = useCallback((_: React.MouseEvent, draggedNode: Node) => {
    if (draggedNode.type !== "noteCard") return;
    dragStartPositionRef.current = { ...draggedNode.position };
  }, []);

  const onNodeDrag = useCallback((_: React.MouseEvent, draggedNode: Node) => {
    if (draggedNode.type !== "noteCard") return;

    const w = draggedNode.measured?.width ?? 240;
    const h = draggedNode.measured?.height ?? 120;
    const center: XYPosition = {
      x: draggedNode.position.x + w / 2,
      y: draggedNode.position.y + h / 2,
    };

    let foundId: string | null = null;
    for (const n of nodesRef.current) {
      if (n.id === draggedNode.id) continue;
      if (n.type !== "clusterNode" && n.type !== "noteCard") continue;
      const nw = n.measured?.width ?? 240;
      const nh = n.measured?.height ?? (n.type === "clusterNode" ? 160 : 120);
      if (
        center.x >= n.position.x &&
        center.x <= n.position.x + nw &&
        center.y >= n.position.y &&
        center.y <= n.position.y + nh
      ) {
        foundId = n.id;
        break;
      }
    }

    if (foundId !== prevDropTargetRef.current) {
      const prev = prevDropTargetRef.current;
      prevDropTargetRef.current = foundId;
      setNodes((nds) =>
        nds.map((n): BoardNode => {
          if (n.id === prev || n.id === foundId) {
            if (n.type === "clusterNode") {
              const c = n as ClusterFlowNode;
              return { ...c, data: { ...c.data, isDropTarget: n.id === foundId } };
            }
            if (n.type === "noteCard") {
              const note = n as NoteFlowNode;
              return { ...note, data: { ...note.data, isDropTarget: n.id === foundId } };
            }
          }
          return n;
        }),
      );
    }
  }, [setNodes]);

  const onNodeDragStop = useCallback((_: React.MouseEvent, draggedNode: Node) => {
    const targetId = prevDropTargetRef.current;
    prevDropTargetRef.current = null;

    if (targetId) {
      setNodes((nds) =>
        nds.map((n): BoardNode => {
          if (n.id !== targetId) return n;
          if (n.type === "clusterNode") return { ...(n as ClusterFlowNode), data: { ...(n as ClusterFlowNode).data, isDropTarget: false } };
          if (n.type === "noteCard") return { ...(n as NoteFlowNode), data: { ...(n as NoteFlowNode).data, isDropTarget: false } };
          return n;
        }),
      );
    }

    if (draggedNode.type !== "noteCard" || !targetId) return;

    const noteNode = draggedNode as NoteFlowNode;
    const startPosition = dragStartPositionRef.current ?? noteNode.position;
    dragStartPositionRef.current = null;

    const targetNode = nodesRef.current.find((n) => n.id === targetId);
    if (!targetNode) return;

    if (targetNode.type === "clusterNode") {
      const addedNoteId = crypto.randomUUID();
      const newNote: ClusterNoteItem = {
        id: addedNoteId,
        body: noteNode.data.body,
        colorKey: noteNode.data.colorKey,
        formatting: noteNode.data.formatting,
      };
      void startPosition; // captured for future undo
      setNodes((nds) =>
        nds
          .filter((n) => n.id !== draggedNode.id)
          .map((n) =>
            n.id === targetId && n.type === "clusterNode"
              ? { ...n, data: { ...n.data, notes: [...(n as ClusterFlowNode).data.notes, newNote] } }
              : n,
          ),
      );
    } else if (targetNode.type === "noteCard") {
      const target = targetNode as NoteFlowNode;
      const newCluster: ClusterFlowNode = {
        id: crypto.randomUUID(),
        type: "clusterNode",
        position: { ...target.position },
        data: {
          notes: [
            { id: crypto.randomUUID(), body: target.data.body, colorKey: target.data.colorKey, formatting: target.data.formatting },
            { id: crypto.randomUUID(), body: noteNode.data.body, colorKey: noteNode.data.colorKey, formatting: noteNode.data.formatting },
          ],
          colorKey: target.data.colorKey ?? DEFAULT_NOTE_COLOR,
        },
      };
      setNodes((nds) => [
        ...nds.filter((n) => n.id !== draggedNode.id && n.id !== targetId),
        newCluster,
      ]);
    }
  }, [setNodes]);

  // ── Context menu direction labels ─────────────────────────────────────────
  const DIRECTION_LABELS: Record<EdgeDirection, string> = {
    none: "— No arrow",
    forward: "→ Forward",
    reverse: "← Reverse",
    both: "↔ Both",
  };

  const contextEdge = contextMenu
    ? (edges.find((e) => e.id === contextMenu.edgeId) as BoardEdgeType | undefined)
    : null;

  return (
    <div
      className="h-dvh w-full bg-white dark:bg-neutral-900"
      data-connecting={connecting ? "true" : undefined}
      onClick={contextMenu ? closeContextMenu : undefined}
      onContextMenu={contextMenu ? (e) => { e.preventDefault(); closeContextMenu(); } : undefined}
    >
      <ReactFlow
        className="h-full w-full touch-manipulation"
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeContextMenu={onEdgeContextMenu}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        fitView
        fitViewOptions={{ padding: 0.35 }}
        minZoom={0.15}
        maxZoom={2}
        connectionMode={ConnectionMode.Loose}
        connectionLineType={ConnectionLineType.Straight}
        deleteKeyCode="Delete"
        defaultEdgeOptions={{ type: "boardEdge" }}
      >
        <Toolbar connecting={connecting} onToggleConnecting={toggleConnecting} />
        <Background gap={18} size={1} className="opacity-40" />
        <Controls />
      </ReactFlow>

      {/* Cluster side panel */}
      {expandedCluster && (
        <ClusterPanel
          clusterId={expandedCluster.id}
          notes={expandedCluster.data.notes}
          onUpdateNote={handleUpdateNote}
          onDeleteNote={handleDeleteNote}
          onAddNote={handleAddNote}
          onClose={handleClosePanel}
          onDeleteCluster={handleDeleteCluster}
          onUncluster={handleUncluster}
        />
      )}

      {/* Edge right-click context menu */}
      {contextMenu && contextEdge && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 min-w-[160px] overflow-hidden rounded-lg border border-black/10 bg-white shadow-xl dark:border-white/10 dark:bg-neutral-800"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">
            Direction
          </div>
          {DIRECTION_CYCLE.map((dir) => {
            const active = contextEdge.data?.direction === dir;
            return (
              <button
                key={dir}
                type="button"
                onClick={() => setEdgeDirection(contextMenu.edgeId, dir)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/8 ${
                  active
                    ? "font-medium text-indigo-600 dark:text-indigo-400"
                    : "text-black/70 dark:text-white/70"
                }`}
              >
                {active
                  ? <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  : <span className="h-1.5 w-1.5" />}
                {DIRECTION_LABELS[dir]}
              </button>
            );
          })}
          <div className="mx-3 my-1 h-px bg-black/8 dark:bg-white/8" />
          <button
            type="button"
            onClick={() => deleteEdge(contextMenu.edgeId)}
            className="flex w-full items-center px-3 py-2 text-sm text-red-500 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            <span className="ml-3.5">Delete edge</span>
          </button>
        </div>
      )}
    </div>
  );
}
