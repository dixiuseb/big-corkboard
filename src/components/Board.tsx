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
import { UndoContext } from "@/lib/UndoContext";

type BoardNode = NoteFlowNode | ClusterFlowNode;

type ContextMenu = { edgeId: string; x: number; y: number };

const DIRECTION_CYCLE: EdgeDirection[] = ["none", "forward", "reverse", "both"];

const initialNodes: BoardNode[] = [];
const initialEdges: BoardEdgeType[] = [];

type Snapshot = { nodes: BoardNode[]; edges: BoardEdgeType[] };
const MAX_HISTORY = 50;

export function Board() {
  const [nodes, setNodes, onNodesChange] = useNodesState<BoardNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<BoardEdgeType>(initialEdges);

  // Always-fresh refs so drag/keyboard callbacks never capture stale state.
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  // ── Undo / redo history ───────────────────────────────────────────────────
  // Two-stack model: each stack holds snapshots of the board state.
  //
  //   pushSnapshot()  — call BEFORE a committed action; saves current state to
  //                     the undo stack and clears the redo stack.
  //   undo()          — pops the undo stack; pushes current state to redo stack.
  //   redo()          — pops the redo stack; pushes current state to undo stack.
  //
  // Stacks are refs (not state) so pushes don't trigger re-renders.
  // canUndo/canRedo are state so the toolbar buttons re-render when availability changes.
  const undoStack = useRef<Snapshot[]>([]);
  const redoStack = useRef<Snapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const pushSnapshot = useCallback(() => {
    undoStack.current.push({ nodes: nodesRef.current, edges: edgesRef.current });
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
    // Any new action clears the redo branch.
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    // Save current live state so redo can return here.
    redoStack.current.push({ nodes: nodesRef.current, edges: edgesRef.current });
    const snap = undoStack.current.pop()!;
    setNodes(snap.nodes);
    setEdges(snap.edges);
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(true);
  }, [setNodes, setEdges]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    // Save current live state so undo can return here.
    undoStack.current.push({ nodes: nodesRef.current, edges: edgesRef.current });
    const snap = redoStack.current.pop()!;
    setNodes(snap.nodes);
    setEdges(snap.edges);
    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
  }, [setNodes, setEdges]);

  // ── Drag-to-pin state ─────────────────────────────────────────────────────
  const prevDropTargetRef = useRef<string | null>(null);

  // ── Connection mode ────────────────────────────────────────────────────────
  const [connecting, setConnecting] = useState(false);
  const toggleConnecting = useCallback(() => setConnecting((v) => !v), []);

  // nodeTypes must be stable across renders to avoid React Flow remounting nodes.
  const nodeTypes = useMemo(() => ({ noteCard: NoteCard, clusterNode: ClusterNode }), []);
  const edgeTypes = useMemo(() => ({ boardEdge: BoardEdge }), []);

  const onConnect = useCallback(
    (params: Connection) => {
      pushSnapshot();
      setEdges((eds) =>
        addEdge(
          { ...params, type: "boardEdge", data: { direction: "none" } },
          eds,
        ) as BoardEdgeType[],
      );
    },
    [setEdges, pushSnapshot],
  );

  // ── Context menu (edge right-click) ───────────────────────────────────────
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);

  const onEdgeContextMenu = useCallback((e: React.MouseEvent, edge: Edge) => {
    e.preventDefault();
    setContextMenu({ edgeId: edge.id, x: e.clientX, y: e.clientY });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const setEdgeDirection = useCallback((edgeId: string, direction: EdgeDirection) => {
    pushSnapshot();
    setEdges((eds) =>
      eds.map((e) =>
        e.id === edgeId
          ? { ...e, data: { ...(e.data as BoardEdgeType["data"]), direction } }
          : e,
      ) as BoardEdgeType[],
    );
    closeContextMenu();
  }, [setEdges, closeContextMenu, pushSnapshot]);

  const deleteEdge = useCallback((edgeId: string) => {
    pushSnapshot();
    setEdges((eds) => eds.filter((e) => e.id !== edgeId) as BoardEdgeType[]);
    closeContextMenu();
  }, [setEdges, closeContextMenu, pushSnapshot]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmd = e.metaKey || e.ctrlKey;

      if (isCmd && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        undo();
        return;
      }
      if (isCmd && e.shiftKey && e.key === "z") {
        e.preventDefault();
        redo();
        return;
      }

      if (e.key === "Escape") {
        setConnecting(false);
        setContextMenu(null);
        return;
      }

      const active = document.activeElement;
      const inInput = active?.tagName === "INPUT" || active?.tagName === "TEXTAREA";
      if (inInput) return;

      // Delete key: remove all selected nodes and any edges touching them.
      if (e.key === "Delete") {
        const selectedNodeIds = new Set(nodesRef.current.filter((n) => n.selected).map((n) => n.id));
        const selectedEdgeIds = new Set(edgesRef.current.filter((ed) => ed.selected).map((ed) => ed.id));
        if (selectedNodeIds.size || selectedEdgeIds.size) {
          pushSnapshot();
          setNodes((nds) => nds.filter((n) => !selectedNodeIds.has(n.id)) as BoardNode[]);
          setEdges((eds) =>
            eds.filter(
              (ed) =>
                !selectedEdgeIds.has(ed.id) &&
                !selectedNodeIds.has(ed.source) &&
                !selectedNodeIds.has(ed.target),
            ) as BoardEdgeType[],
          );
        }
      }

      // Backspace: remove only selected edges (never nodes — protects text inputs).
      if (e.key === "Backspace") {
        const selectedEdges = edgesRef.current.filter((ed) => ed.selected);
        if (selectedEdges.length) {
          pushSnapshot();
          setEdges((eds) => eds.filter((ed) => !ed.selected) as BoardEdgeType[]);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, pushSnapshot, setNodes, setEdges]);

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
      pushSnapshot();
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
    [expandedCluster, setNodes, updateClusterNodes, pushSnapshot],
  );

  const handleDeleteCluster = useCallback(() => {
    if (!expandedCluster) return;
    pushSnapshot();
    setNodes((nds) => nds.filter((n) => n.id !== expandedCluster.id));
  }, [expandedCluster, setNodes, pushSnapshot]);

  const handleUncluster = useCallback(() => {
    if (!expandedCluster) return;
    pushSnapshot();
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
  }, [expandedCluster, setNodes, pushSnapshot]);

  const handleAddNote = useCallback(() => {
    if (!expandedCluster) return;
    pushSnapshot();
    const newNote: ClusterNoteItem = {
      id: crypto.randomUUID(),
      body: "",
      colorKey: expandedCluster.data.colorKey ?? DEFAULT_NOTE_COLOR,
    };
    updateClusterNodes(expandedCluster.id, (n) => ({
      ...n,
      data: { ...n.data, notes: [...n.data.notes, newNote] },
    }));
  }, [expandedCluster, updateClusterNodes, pushSnapshot]);

  // ── Drag-to-pin handlers ──────────────────────────────────────────────────

  const onNodeDragStart = useCallback(() => {
    // Snapshot the board state before the drag begins so the move (or pin) is undoable.
    pushSnapshot();
  }, [pushSnapshot]);

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
    const targetNode = nodesRef.current.find((n) => n.id === targetId);
    if (!targetNode) return;

    if (targetNode.type === "clusterNode") {
      const newNote: ClusterNoteItem = {
        id: crypto.randomUUID(),
        body: noteNode.data.body,
        colorKey: noteNode.data.colorKey,
        formatting: noteNode.data.formatting,
      };
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

  const undoContextValue = useMemo(() => ({ pushSnapshot }), [pushSnapshot]);

  return (
    <UndoContext.Provider value={undoContextValue}>
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
          deleteKeyCode={null}
          defaultEdgeOptions={{ type: "boardEdge" }}
        >
          <Toolbar
            connecting={connecting}
            onToggleConnecting={toggleConnecting}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
          />
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
    </UndoContext.Provider>
  );
}
