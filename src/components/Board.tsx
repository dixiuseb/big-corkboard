"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  ConnectionMode,
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
import { ClusterPanel } from "@/components/ClusterPanel";
import { Toolbar } from "@/components/Toolbar";
import { DEFAULT_NOTE_COLOR } from "@/lib/noteColors";

type BoardNode = NoteFlowNode | ClusterFlowNode;

type PinUndoAction = {
  node: NoteFlowNode;
  clusterId: string;
  addedNoteId: string;
};

const initialNodes: BoardNode[] = [];
const initialEdges: Edge[] = [];

export function Board() {
  const [nodes, setNodes, onNodesChange] = useNodesState<BoardNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Always-fresh ref so drag callbacks don't capture stale node lists.
  const nodesRef = useRef(nodes);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  // ── Drag-to-pin state ─────────────────────────────────────────────────────
  const prevDropTargetRef = useRef<string | null>(null);
  const dragStartPositionRef = useRef<XYPosition | null>(null);
  const [pinUndo, setPinUndo] = useState<PinUndoAction | null>(null);

  // nodeTypes must be stable across renders to avoid React Flow remounting nodes.
  const nodeTypes = useMemo(() => ({ noteCard: NoteCard, clusterNode: ClusterNode }), []);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

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
          // Keep cluster's primary color in sync with first note.
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
        // Auto-delete empty cluster.
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
      // Spread notes in a gentle diagonal so they don't stack exactly.
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
      if (n.type !== "clusterNode") continue;
      const cw = n.measured?.width ?? 240;
      const ch = n.measured?.height ?? 160;
      if (
        center.x >= n.position.x &&
        center.x <= n.position.x + cw &&
        center.y >= n.position.y &&
        center.y <= n.position.y + ch
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
          if (n.type !== "clusterNode") return n;
          const c = n as ClusterFlowNode;
          if (c.id === prev) return { ...c, data: { ...c.data, isDropTarget: false } };
          if (c.id === foundId) return { ...c, data: { ...c.data, isDropTarget: true } };
          return c;
        }),
      );
    }
  }, [setNodes]);

  const onNodeDragStop = useCallback((_: React.MouseEvent, draggedNode: Node) => {
    const targetId = prevDropTargetRef.current;

    // Always clear the drop-target highlight.
    if (targetId) {
      setNodes((nds) =>
        nds.map((n): BoardNode =>
          n.id === targetId && n.type === "clusterNode"
            ? { ...(n as ClusterFlowNode), data: { ...(n as ClusterFlowNode).data, isDropTarget: false } }
            : n,
        ),
      );
      prevDropTargetRef.current = null;
    }

    if (draggedNode.type !== "noteCard" || !targetId) return;

    const noteNode = draggedNode as NoteFlowNode;
    const addedNoteId = crypto.randomUUID();
    const newNote: ClusterNoteItem = {
      id: addedNoteId,
      body: noteNode.data.body,
      colorKey: noteNode.data.colorKey,
      formatting: noteNode.data.formatting,
    };

    // Record start position for undo restoration.
    const startPosition = dragStartPositionRef.current ?? noteNode.position;
    setPinUndo({ node: { ...noteNode, position: startPosition }, clusterId: targetId, addedNoteId });
    dragStartPositionRef.current = null;

    setNodes((nds) =>
      nds
        .filter((n) => n.id !== draggedNode.id)
        .map((n) =>
          n.id === targetId && n.type === "clusterNode"
            ? { ...n, data: { ...n.data, notes: [...(n as ClusterFlowNode).data.notes, newNote] } }
            : n,
        ),
    );
  }, [setNodes]);

  // Single-level undo for drag-to-pin (Cmd+Z / Ctrl+Z).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!pinUndo) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        const { node, clusterId, addedNoteId } = pinUndo;
        setNodes((nds) => [
          ...nds.map((n) =>
            n.id === clusterId && n.type === "clusterNode"
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    notes: (n as ClusterFlowNode).data.notes.filter((note) => note.id !== addedNoteId),
                  },
                }
              : n,
          ),
          node,
        ]);
        setPinUndo(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pinUndo, setNodes]);

  return (
    <div className="h-dvh w-full bg-white dark:bg-neutral-900">
      <ReactFlow
        className="h-full w-full touch-manipulation"
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        fitView
        fitViewOptions={{ padding: 0.35 }}
        minZoom={0.15}
        maxZoom={2}
        connectionMode={ConnectionMode.Loose}
        deleteKeyCode="Delete"
      >
        <Toolbar />
        <Background gap={18} size={1} className="opacity-40" />
        <Controls />
      </ReactFlow>

      {/* Cluster side panel — rendered outside ReactFlow so it isn't affected by canvas zoom */}
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
    </div>
  );
}
