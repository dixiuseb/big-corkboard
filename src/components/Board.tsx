"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  ConnectionMode,
  ConnectionLineType,
  SelectionMode,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useStoreApi,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  type Viewport,
  type XYPosition,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import NoteCard, {
  type NoteFlowNode,
  type NoteFormatting,
  type NoteFontSize,
} from "@/components/NoteCard";
import ClusterNode, {
  type ClusterFlowNode,
  type ClusterNoteItem,
} from "@/components/ClusterNode";
import { BoardEdge, type BoardEdgeType, type EdgeDirection } from "@/components/BoardEdge";
import { ClusterPanel } from "@/components/ClusterPanel";
import { Toolbar, type WorkspaceFileMenuActions, type CanvasTool } from "@/components/Toolbar";
import { DEFAULT_NOTE_COLOR, type NoteColorKey } from "@/lib/noteColors";
import { UndoContext } from "@/lib/UndoContext";
import {
  loadBoardsMeta,
  saveBoardsMeta,
  loadBoardState,
  saveBoardState,
  deleteBoardState,
  loadActiveBoard,
  saveActiveBoard,
  type BoardMeta,
  type BoardColorLabels,
  type PersistedBoardState,
} from "@/lib/persistence";
import { BoardTabs } from "@/components/BoardTabs";
import { ColorLegend } from "@/components/ColorLegend";
import { CategoryFilterContext } from "@/lib/CategoryFilterContext";
import { SearchContext, buildSearchSessionValue } from "@/lib/SearchContext";
import { buildSearchMatches } from "@/lib/searchMatches";
import { BoardSearchBar } from "@/components/BoardSearchBar";
import { SearchMatchViewport } from "@/components/SearchMatchViewport";
import {
  downloadWorkspaceJson,
  parseWorkspaceImportJson,
  applyWorkspaceImport,
  WORKSPACE_MAX_BOARDS,
} from "@/lib/workspaceJson";

type BoardNode = NoteFlowNode | ClusterFlowNode;

type ContextMenu = { edgeId: string; x: number; y: number };

const DIRECTION_CYCLE: EdgeDirection[] = ["none", "forward", "reverse", "both"];

type Snapshot = { nodes: BoardNode[]; edges: BoardEdgeType[]; colorLabels: BoardColorLabels };
const MAX_HISTORY = 50;
const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

// Strip React Flow's internal runtime properties before writing to localStorage.
// Also clear UI-only flags (isDropTarget, expanded) that shouldn't survive a reload.
function serializeNodes(nodes: BoardNode[]): object[] {
  return nodes.map((n) => {
    const base = { id: n.id, type: n.type, position: n.position };
    if (n.type === "noteCard") {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { isDropTarget: _dt, ...cleanData } = n.data;
      return { ...base, data: cleanData };
    }
    // clusterNode
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { isDropTarget: _dt, expanded: _ex, ...cleanData } = (n as ClusterFlowNode).data;
    return { ...base, data: cleanData };
  });
}

function serializeEdges(edges: BoardEdgeType[]): object[] {
  return edges.map(({ id, source, target, sourceHandle, targetHandle, type, data }) => ({
    id, source, target, sourceHandle, targetHandle, type, data,
  }));
}

/** Point every edge that used oldId at newId; drop self-loops; merge duplicate endpoint pairs. */
function remapEdgesReplaceNodeId(edges: BoardEdgeType[], oldId: string, newId: string): BoardEdgeType[] {
  if (oldId === newId) return edges;
  const remapped = edges.map((e) => ({
    ...e,
    source: e.source === oldId ? newId : e.source,
    target: e.target === oldId ? newId : e.target,
  }));
  const noSelf = remapped.filter((e) => e.source !== e.target);
  const seen = new Set<string>();
  const out: BoardEdgeType[] = [];
  for (const e of noSelf) {
    const key = `${e.source}|${e.target}|${e.sourceHandle ?? ""}|${e.targetHandle ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

// ── Viewport resetter (must live inside the ReactFlow provider) ───────────────
function ViewportResetter({ signal }: { signal: number }) {
  const { setViewport } = useReactFlow();
  useEffect(() => {
    if (signal > 0) setViewport(DEFAULT_VIEWPORT, { duration: 0 });
  }, [signal, setViewport]);
  return null;
}

// ── screenToFlowPosition capture (must live inside the ReactFlow provider) ────
// Assigns the latest screenToFlowPosition to a ref so the outer drop handler
// (which can't call hooks itself) can convert screen coords to canvas coords.
type SFPFn = (pos: XYPosition) => XYPosition;
function SFPCapture({ sfpRef }: { sfpRef: React.MutableRefObject<SFPFn | null> }) {
  const { screenToFlowPosition } = useReactFlow();
  sfpRef.current = screenToFlowPosition;
  return null;
}

/** Clears a stuck Shift-marquee overlay when pointerup happens outside the flow pane. */
function BoardUserSelectionPointerFlush() {
  const store = useStoreApi();
  useEffect(() => {
    const flushStuckUserSelection = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = store.getState() as any;
      if (s.userSelectionActive || s.userSelectionRect != null) {
        store.setState({ userSelectionActive: false, userSelectionRect: null });
      }
    };
    window.addEventListener("pointerup", flushStuckUserSelection);
    window.addEventListener("pointercancel", flushStuckUserSelection);
    return () => {
      window.removeEventListener("pointerup", flushStuckUserSelection);
      window.removeEventListener("pointercancel", flushStuckUserSelection);
    };
  }, [store]);
  return null;
}

// ── BoardCanvas ──────────────────────────────────────────────────────────────
// Renders the React Flow canvas for a single board. Keyed by boardId in the
// outer Board shell so React remounts it cleanly whenever the active board changes.

function BoardCanvas({
  boardId,
  boardTitle,
  workspaceFile,
}: {
  boardId: string;
  boardTitle: string;
  workspaceFile: WorkspaceFileMenuActions;
}) {
  const [savedState] = useState<PersistedBoardState | null>(() => loadBoardState(boardId));

  const [nodes, setNodes, onNodesChange] = useNodesState<BoardNode>(
    (savedState?.nodes ?? []) as BoardNode[],
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<BoardEdgeType>(
    (savedState?.edges ?? []) as BoardEdgeType[],
  );

  const [colorLabels, setColorLabels] = useState<BoardColorLabels>(
    () => savedState?.colorLabels ?? {},
  );
  const colorLabelsRef = useRef(colorLabels);
  useEffect(() => {
    colorLabelsRef.current = colorLabels;
  }, [colorLabels]);

  /** Dim canvas nodes that don’t match this note color (legend swatch). */
  const [categoryFilterColor, setCategoryFilterColor] = useState<NoteColorKey | null>(null);
  const toggleCategoryFilter = useCallback((key: NoteColorKey) => {
    setCategoryFilterColor((prev) => (prev === key ? null : key));
  }, []);

  // ── Search (Cmd/Ctrl+F) ───────────────────────────────────────────────────
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [searchActiveIndex, setSearchActiveIndex] = useState(0);

  useEffect(() => {
    if (!searchOpen) {
      setDebouncedSearchQuery("");
      return;
    }
    const t = window.setTimeout(() => {
      setDebouncedSearchQuery(searchInput.trim().toLowerCase());
    }, 150);
    return () => window.clearTimeout(t);
  }, [searchInput, searchOpen]);

  useEffect(() => {
    setSearchActiveIndex(0);
  }, [debouncedSearchQuery]);

  const searchMatches = useMemo(
    () => buildSearchMatches(nodes, debouncedSearchQuery),
    [nodes, debouncedSearchQuery],
  );

  const defaultViewport = savedState?.viewport ?? DEFAULT_VIEWPORT;

  // Tracks the latest viewport so it's included in auto-saves.
  const viewportRef = useRef<Viewport>(defaultViewport);

  // Save immediately on unmount so unsaved changes aren't lost when switching boards.
  // boardId is stable within a BoardCanvas instance (enforced by key={boardId} in Board).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => {
    saveBoardState(boardId, {
      nodes: serializeNodes(nodesRef.current),
      edges: serializeEdges(edgesRef.current),
      viewport: viewportRef.current,
      colorLabels: { ...colorLabelsRef.current },
    });
  }, []);

  // ── Debounced auto-save (nodes + edges + current viewport) ────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      saveBoardState(boardId, {
        nodes: serializeNodes(nodes),
        edges: serializeEdges(edges),
        viewport: viewportRef.current,
        colorLabels: { ...colorLabelsRef.current },
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [nodes, edges, colorLabels, boardId]);

  const onMoveEnd = useCallback((_: unknown, viewport: Viewport) => {
    viewportRef.current = viewport;
    // Save immediately on viewport change (panning / zooming without editing).
    saveBoardState(boardId, {
      nodes: serializeNodes(nodesRef.current),
      edges: serializeEdges(edgesRef.current),
      viewport,
      colorLabels: { ...colorLabelsRef.current },
    });
  }, [boardId]);

  // Signal for ViewportResetter (incremented on "Clear board").
  const [resetViewportSignal, setResetViewportSignal] = useState(0);

  // Capture screenToFlowPosition from inside the ReactFlow provider via SFPCapture.
  const sfpRef = useRef<SFPFn | null>(null);
  // Called by handleCanvasDrop so ClusterPanel clears its ghost image immediately,
  // bypassing the unreliable dragend timing when the drag source unmounts first.
  const clearClusterGhostRef = useRef<() => void>(() => {});

  // Always-fresh refs so drag/keyboard callbacks never capture stale state.
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const setSelectedPanelNoteIdRef = useRef<(id: string | null) => void>(() => {});
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
    undoStack.current.push({
      nodes: nodesRef.current,
      edges: edgesRef.current,
      colorLabels: { ...colorLabelsRef.current },
    });
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
    // Any new action clears the redo branch.
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    // Save current live state so redo can return here.
    redoStack.current.push({
      nodes: nodesRef.current,
      edges: edgesRef.current,
      colorLabels: { ...colorLabelsRef.current },
    });
    const snap = undoStack.current.pop()!;
    setNodes(snap.nodes);
    setEdges(snap.edges);
    setColorLabels({ ...(snap.colorLabels ?? {}) });
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(true);
  }, [setNodes, setEdges, setColorLabels]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    // Save current live state so undo can return here.
    undoStack.current.push({
      nodes: nodesRef.current,
      edges: edgesRef.current,
      colorLabels: { ...colorLabelsRef.current },
    });
    const snap = redoStack.current.pop()!;
    setNodes(snap.nodes);
    setEdges(snap.edges);
    setColorLabels({ ...(snap.colorLabels ?? {}) });
    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
  }, [setNodes, setEdges, setColorLabels]);

  // ── Drag-to-pin state ─────────────────────────────────────────────────────
  const prevDropTargetRef = useRef<string | null>(null);

  // ── Connection mode ────────────────────────────────────────────────────────
  const [connecting, setConnecting] = useState(false);
  const toggleConnecting = useCallback(() => setConnecting((v) => !v), []);

  const [canvasTool, setCanvasTool] = useState<CanvasTool>("pan");

  // ── Default note settings (applied to new notes; updated when editing any note) ──
  const [defaultSettings, setDefaultSettings] = useState<{
    colorKey: NoteColorKey;
    formatting: NoteFormatting;
  }>({ colorKey: DEFAULT_NOTE_COLOR, formatting: {} });

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

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchInput("");
    setDebouncedSearchQuery("");
    setSearchActiveIndex(0);
    setConnecting(false);
    setContextMenu(null);
  }, [setConnecting, setContextMenu]);

  const openSearch = useCallback(() => {
    setSearchOpen(true);
  }, []);

  const goSearchNext = useCallback(() => {
    setSearchActiveIndex((i) => {
      if (searchMatches.length === 0) return 0;
      return (i + 1) % searchMatches.length;
    });
  }, [searchMatches.length]);

  const goSearchPrev = useCallback(() => {
    setSearchActiveIndex((i) => {
      if (searchMatches.length === 0) return 0;
      return (i - 1 + searchMatches.length) % searchMatches.length;
    });
  }, [searchMatches.length]);

  const searchSessionValue = useMemo(
    () => buildSearchSessionValue(searchOpen, debouncedSearchQuery, searchMatches, searchActiveIndex),
    [searchOpen, debouncedSearchQuery, searchMatches, searchActiveIndex],
  );

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

      if (isCmd && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }

      if (e.key === "Escape") {
        if (searchOpen) {
          closeSearch();
          return;
        }
        const ae = document.activeElement as HTMLElement | null;
        const inEditable =
          ae &&
          (ae.tagName === "INPUT" ||
            ae.tagName === "TEXTAREA" ||
            ae.tagName === "SELECT" ||
            ae.isContentEditable);
        if (inEditable) return;

        setConnecting(false);
        setContextMenu(null);
        setCategoryFilterColor(null);
        setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
        setEdges((eds) => eds.map((ed) => ({ ...ed, selected: false })));
        setSelectedPanelNoteIdRef.current(null);
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
  }, [undo, redo, pushSnapshot, setNodes, setEdges, searchOpen, closeSearch]);

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
      updateClusterNodes(expandedCluster.id, (n) => {
        const nextNotes = n.data.notes.map((note) =>
          note.id === noteId ? { ...note, ...update } : note,
        );
        return {
          ...n,
          data: {
            ...n.data,
            notes: nextNotes,
            colorKey: nextNotes[0]?.colorKey ?? DEFAULT_NOTE_COLOR,
          },
        };
      });
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
          data: {
            ...n.data,
            notes: remaining,
            colorKey: remaining[0]?.colorKey ?? DEFAULT_NOTE_COLOR,
          },
        }));
      }
    },
    [expandedCluster, setNodes, updateClusterNodes, pushSnapshot],
  );

  const handleEjectNote = useCallback(
    (noteId: string) => {
      if (!expandedCluster) return;
      const note = expandedCluster.data.notes.find((n) => n.id === noteId);
      if (!note) return;
      pushSnapshot();
      const remaining = expandedCluster.data.notes.filter((n) => n.id !== noteId);
      // Place the ejected note just to the left of the cluster so it's immediately visible.
      const ejectPos = {
        x: expandedCluster.position.x - 270,
        y: expandedCluster.position.y,
      };
      const looseNote: NoteFlowNode = {
        id: crypto.randomUUID(),
        type: "noteCard",
        position: ejectPos,
        data: { body: note.body, colorKey: note.colorKey, formatting: note.formatting },
      };
      if (remaining.length === 0) {
        // Cluster is now empty — remove it and place just the note.
        setNodes((nds) => [...nds.filter((n) => n.id !== expandedCluster.id), looseNote]);
      } else {
        updateClusterNodes(expandedCluster.id, (n) => ({
          ...n,
          data: {
            ...n.data,
            notes: remaining,
            colorKey: remaining[0]?.colorKey ?? DEFAULT_NOTE_COLOR,
          },
        }));
        setNodes((nds) => [...nds, looseNote]);
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
      id: i === 0 ? expandedCluster.id : crypto.randomUUID(),
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

  const handleReorderNotes = useCallback((reorderedNotes: ClusterNoteItem[]) => {
    if (!expandedCluster) return;
    pushSnapshot();
    updateClusterNodes(expandedCluster.id, (n) => ({
      ...n,
      data: {
        ...n.data,
        notes: reorderedNotes,
        colorKey: reorderedNotes[0]?.colorKey ?? DEFAULT_NOTE_COLOR,
      },
    }));
  }, [expandedCluster, updateClusterNodes, pushSnapshot]);

  // ── Panel note selection (lifted from ClusterPanel so the toolbar can see it) ──
  const [selectedPanelNoteId, setSelectedPanelNoteId] = useState<string | null>(null);

  useLayoutEffect(() => {
    setSelectedPanelNoteIdRef.current = setSelectedPanelNoteId;
  }, [setSelectedPanelNoteId]);

  // Reset panel selection when the open cluster changes.
  useEffect(() => { setSelectedPanelNoteId(null); }, [expandedCluster?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Which canvas nodes (notes + clusters) are selected? Multi-select uses Meta/Ctrl+click or Shift+drag box.
  const selectedCanvasNodes = useMemo(
    () =>
      nodes.filter(
        (n) => n.selected && (n.type === "noteCard" || n.type === "clusterNode"),
      ) as BoardNode[],
    [nodes],
  );

  const selectedCanvasSignature = useMemo(
    () => selectedCanvasNodes.map((n) => n.id).join(","),
    [selectedCanvasNodes],
  );

  /** First selected canvas node in list order — drives toolbar preview for mixed selections. */
  const primaryCanvasForToolbar = useMemo((): NoteFlowNode | ClusterFlowNode | null => {
    const idSet = new Set(selectedCanvasNodes.map((n) => n.id));
    for (const n of nodes) {
      if (idSet.has(n.id) && (n.type === "noteCard" || n.type === "clusterNode")) {
        return n as NoteFlowNode | ClusterFlowNode;
      }
    }
    return null;
  }, [nodes, selectedCanvasNodes]);

  /** True when toolbar "Cluster" can run: one note → promote, or 2+ notes only → combine. */
  const canCreateCluster = useMemo(() => {
    const s = nodes.filter(
      (n) => n.selected && (n.type === "noteCard" || n.type === "clusterNode"),
    );
    if (s.length === 1 && s[0].type === "noteCard") return true;
    return s.length >= 2 && s.every((n) => n.type === "noteCard");
  }, [nodes]);

  // Which panel note is currently selected?
  const selectedPanelNote = useMemo(
    () => expandedCluster?.data.notes.find((n) => n.id === selectedPanelNoteId) ?? null,
    [expandedCluster, selectedPanelNoteId],
  );

  // Selecting any canvas node clears the panel selection.
  useEffect(() => {
    if (selectedCanvasNodes.length > 0) setSelectedPanelNoteId(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCanvasSignature]);

  // Selecting a panel note deselects all canvas nodes.
  const handleSelectPanelNote = useCallback((noteId: string | null) => {
    setSelectedPanelNoteId(noteId);
    if (noteId) {
      setNodes((nds) => nds.map((n) => (n.selected ? { ...n, selected: false } : n)));
    }
  }, [setNodes]);

  const onSearchClusterInternalActive = useCallback((clusterId: string, noteId: string) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.type !== "clusterNode") return n;
        const expanded = n.id === clusterId;
        return n.data.expanded === expanded ? n : { ...n, data: { ...n.data, expanded } };
      }),
    );
    setSelectedPanelNoteId(noteId);
  }, [setNodes]);

  const onSearchCollapseClusters = useCallback(() => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.type === "clusterNode" && n.data.expanded) {
          return { ...n, data: { ...n.data, expanded: false } };
        }
        return n;
      }),
    );
    setSelectedPanelNoteId(null);
  }, [setNodes]);

  const toolbarColorKey: NoteColorKey = useMemo(() => {
    if (selectedPanelNote) return selectedPanelNote.colorKey ?? DEFAULT_NOTE_COLOR;
    const n = primaryCanvasForToolbar;
    if (!n) return defaultSettings.colorKey;
    if (n.type === "noteCard") return n.data.colorKey ?? DEFAULT_NOTE_COLOR;
    const c = n as ClusterFlowNode;
    return c.data.notes[0]?.colorKey ?? c.data.colorKey ?? DEFAULT_NOTE_COLOR;
  }, [selectedPanelNote, primaryCanvasForToolbar, defaultSettings.colorKey]);

  const toolbarFormatting: NoteFormatting = useMemo(() => {
    if (selectedPanelNote) return selectedPanelNote.formatting ?? {};
    const n = primaryCanvasForToolbar;
    if (!n) return defaultSettings.formatting;
    if (n.type === "noteCard") return n.data.formatting ?? {};
    const notes = (n as ClusterFlowNode).data.notes;
    return notes[0]?.formatting ?? {};
  }, [selectedPanelNote, primaryCanvasForToolbar, defaultSettings.formatting]);

  // ── Toolbar note-formatting callbacks ─────────────────────────────────────
  // Each callback applies the change to the active note (canvas or panel) and
  // also updates defaultSettings so the next new note inherits the preference.

  const handleToolbarColor = useCallback(
    (key: NoteColorKey) => {
      setDefaultSettings((s) => ({ ...s, colorKey: key }));
      const hasCanvas = nodesRef.current.some(
        (n) => n.selected && (n.type === "noteCard" || n.type === "clusterNode"),
      );
      if (hasCanvas) {
        pushSnapshot();
        setNodes((nds) =>
          nds.map((n) => {
            if (!n.selected) return n;
            if (n.type === "noteCard") {
              return { ...n, data: { ...n.data, colorKey: key } };
            }
            if (n.type === "clusterNode") {
              const c = n as ClusterFlowNode;
              return {
                ...c,
                data: {
                  ...c.data,
                  colorKey: key,
                  notes: c.data.notes.map((note) => ({ ...note, colorKey: key })),
                },
              };
            }
            return n;
          }) as BoardNode[],
        );
      } else if (selectedPanelNote) {
        pushSnapshot();
        handleUpdateNote(selectedPanelNote.id, { colorKey: key });
      }
    },
    [selectedPanelNote, pushSnapshot, setNodes, handleUpdateNote],
  );

  const handleToolbarFontSize = useCallback(
    (size: NoteFontSize) => {
      const hasCanvas = nodesRef.current.some(
        (n) => n.selected && (n.type === "noteCard" || n.type === "clusterNode"),
      );
      if (hasCanvas) {
        pushSnapshot();
        setNodes((nds) =>
          nds.map((n) => {
            if (!n.selected) return n;
            if (n.type === "noteCard") {
              return {
                ...n,
                data: {
                  ...n.data,
                  formatting: { ...(n.data.formatting ?? {}), fontSize: size },
                },
              };
            }
            if (n.type === "clusterNode") {
              const c = n as ClusterFlowNode;
              return {
                ...c,
                data: {
                  ...c.data,
                  notes: c.data.notes.map((note) => ({
                    ...note,
                    formatting: { ...(note.formatting ?? {}), fontSize: size },
                  })),
                },
              };
            }
            return n;
          }) as BoardNode[],
        );
        const primary = primaryCanvasForToolbar;
        if (primary?.type === "noteCard") {
          setDefaultSettings((s) => ({
            ...s,
            formatting: { ...(primary.data.formatting ?? {}), fontSize: size },
          }));
        } else if (primary?.type === "clusterNode") {
          const note = (primary as ClusterFlowNode).data.notes[0];
          setDefaultSettings((s) => ({
            ...s,
            formatting: { ...(note?.formatting ?? {}), fontSize: size },
          }));
        }
      } else if (selectedPanelNote) {
        const newFmt = { ...(selectedPanelNote.formatting ?? {}), fontSize: size };
        pushSnapshot();
        handleUpdateNote(selectedPanelNote.id, { formatting: newFmt });
        setDefaultSettings((s) => ({ ...s, formatting: newFmt }));
      } else {
        setDefaultSettings((s) => ({ ...s, formatting: { ...s.formatting, fontSize: size } }));
      }
    },
    [selectedPanelNote, primaryCanvasForToolbar, pushSnapshot, setNodes, handleUpdateNote],
  );

  const handleToolbarToggleFormat = useCallback(
    (key: keyof Omit<NoteFormatting, "fontSize">) => {
      const nds = nodesRef.current;
      const selected = nds.filter(
        (n) => n.selected && (n.type === "noteCard" || n.type === "clusterNode"),
      );
      const onlyOneCanvas = selected.length === 1;
      const hasCanvas = selected.length > 0;
      if (hasCanvas) {
        pushSnapshot();
        setNodes((cur) =>
          cur.map((n) => {
            if (!n.selected) return n;
            if (n.type === "noteCard") {
              const newFmt = {
                ...(n.data.formatting ?? {}),
                [key]: !n.data.formatting?.[key],
              };
              return { ...n, data: { ...n.data, formatting: newFmt } };
            }
            if (n.type === "clusterNode") {
              const c = n as ClusterFlowNode;
              return {
                ...c,
                data: {
                  ...c.data,
                  notes: c.data.notes.map((note) => {
                    const newFmt = {
                      ...(note.formatting ?? {}),
                      [key]: !note.formatting?.[key],
                    };
                    return { ...note, formatting: newFmt };
                  }),
                },
              };
            }
            return n;
          }) as BoardNode[],
        );
        if (onlyOneCanvas) {
          const n = selected[0];
          if (n.type === "noteCard") {
            const newFmt = {
              ...(n.data.formatting ?? {}),
              [key]: !n.data.formatting?.[key],
            };
            setDefaultSettings((s) => ({ ...s, formatting: newFmt }));
          } else {
            const note = (n as ClusterFlowNode).data.notes[0];
            if (note) {
              const newFmt = { ...(note.formatting ?? {}), [key]: !note.formatting?.[key] };
              setDefaultSettings((s) => ({ ...s, formatting: newFmt }));
            }
          }
        }
      } else if (selectedPanelNote) {
        const newFmt = {
          ...(selectedPanelNote.formatting ?? {}),
          [key]: !selectedPanelNote.formatting?.[key],
        };
        pushSnapshot();
        handleUpdateNote(selectedPanelNote.id, { formatting: newFmt });
        setDefaultSettings((s) => ({ ...s, formatting: newFmt }));
      } else {
        setDefaultSettings((s) => ({
          ...s,
          formatting: { ...s.formatting, [key]: !s.formatting[key as keyof NoteFormatting] },
        }));
      }
    },
    [selectedPanelNote, pushSnapshot, setNodes, handleUpdateNote],
  );

  const handleToolbarDelete = useCallback(() => {
    const ids = new Set(
      nodesRef.current
        .filter((n) => n.selected && (n.type === "noteCard" || n.type === "clusterNode"))
        .map((n) => n.id),
    );
    if (ids.size > 0) {
      pushSnapshot();
      setNodes((nds) => nds.filter((n) => !ids.has(n.id)) as BoardNode[]);
      setEdges((eds) =>
        eds.filter((ed) => !ids.has(ed.source) && !ids.has(ed.target)) as BoardEdgeType[],
      );
    } else if (selectedPanelNote) {
      handleDeleteNote(selectedPanelNote.id);
    }
  }, [selectedPanelNote, pushSnapshot, setNodes, setEdges, handleDeleteNote]);

  const handleToolbarCreateCluster = useCallback(() => {
    const nds = nodesRef.current;
    const selected = nds.filter(
      (n) => n.selected && (n.type === "noteCard" || n.type === "clusterNode"),
    );
    const selectedNotes = selected.filter((n): n is NoteFlowNode => n.type === "noteCard");
    const allSelectedAreNotes =
      selected.length >= 2 && selected.every((n) => n.type === "noteCard");

    if (allSelectedAreNotes && selectedNotes.length >= 2) {
      const idSet = new Set(selectedNotes.map((n) => n.id));
      const ordered = nds.filter((n): n is NoteFlowNode => n.type === "noteCard" && idSet.has(n.id));
      const anchor = ordered[0];
      pushSnapshot();
      let nextEdges = edgesRef.current;
      for (const n of ordered.slice(1)) {
        nextEdges = remapEdgesReplaceNodeId(nextEdges, n.id, anchor.id);
      }
      const newCluster: ClusterFlowNode = {
        id: anchor.id,
        type: "clusterNode",
        position: { ...anchor.position },
        data: {
          notes: ordered.map((n) => ({
            id: crypto.randomUUID(),
            body: n.data.body,
            colorKey: n.data.colorKey ?? DEFAULT_NOTE_COLOR,
            formatting: n.data.formatting,
          })),
          colorKey: anchor.data.colorKey ?? DEFAULT_NOTE_COLOR,
        },
      };
      const removeIds = new Set(ordered.slice(1).map((n) => n.id));
      setNodes((cur) =>
        cur
          .filter((n) => !removeIds.has(n.id))
          .map((n) => (n.id === anchor.id ? newCluster : n)) as BoardNode[],
      );
      setEdges(nextEdges);
      return;
    }

    if (selected.length !== 1 || selected[0].type !== "noteCard") return;
    const note = selected[0];
    pushSnapshot();
    const newClusterSingle: ClusterFlowNode = {
      id: note.id,
      type: "clusterNode",
      position: { ...note.position },
      data: {
        notes: [{
          id: crypto.randomUUID(),
          body: note.data.body,
          colorKey: note.data.colorKey ?? DEFAULT_NOTE_COLOR,
          formatting: note.data.formatting,
        }],
        colorKey: note.data.colorKey ?? DEFAULT_NOTE_COLOR,
      },
    };
    setNodes((cur) => cur.map((n) => (n.id === note.id ? newClusterSingle : n)) as BoardNode[]);
  }, [pushSnapshot, setNodes, setEdges]);

  // ── Drag-to-pin handlers ──────────────────────────────────────────────────

  const onNodeDragStart = useCallback(() => {
    // Snapshot the board state before the drag begins so the move (or pin) is undoable.
    pushSnapshot();
  }, [pushSnapshot]);

  const onNodeDrag = useCallback((_: React.MouseEvent, draggedNode: Node) => {
    const multi =
      nodesRef.current.filter(
        (n) => n.selected && (n.type === "noteCard" || n.type === "clusterNode"),
      ).length > 1;
    if (multi) return;

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
    const multi =
      nodesRef.current.filter(
        (n) => n.selected && (n.type === "noteCard" || n.type === "clusterNode"),
      ).length > 1;

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

    if (multi) return;

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
      setEdges((eds) => remapEdgesReplaceNodeId(eds, draggedNode.id, targetId));
    } else if (targetNode.type === "noteCard") {
      const target = targetNode as NoteFlowNode;
      // Reuse the target note's id for the new cluster so its edges stay valid; remap the dragged note's edges here.
      const newCluster: ClusterFlowNode = {
        id: target.id,
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
        ...nds.filter((n) => n.id !== draggedNode.id && n.id !== target.id),
        newCluster,
      ]);
      setEdges((eds) => remapEdgesReplaceNodeId(eds, draggedNode.id, target.id));
    }
  }, [setNodes, setEdges]);

  // ── Drag-out from cluster panel ───────────────────────────────────────────
  // Notes dragged from ClusterPanel land on the canvas as loose noteCard nodes.
  // The DataTransfer carries the serialised ClusterNoteItem JSON so we don't
  // need any shared React state between the panel and the canvas.

  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/x-corkboard-note")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    }
  }, []);

  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/x-corkboard-note");
    if (!raw || !sfpRef.current) return;
    let note: ClusterNoteItem;
    try {
      note = JSON.parse(raw) as ClusterNoteItem;
    } catch {
      return;
    }

    // Locate the cluster that owns this note (use fresh ref so we see latest state).
    const cluster = nodesRef.current.find(
      (n): n is ClusterFlowNode =>
        n.type === "clusterNode" &&
        (n as ClusterFlowNode).data.notes.some((nn) => nn.id === note.id),
    );
    if (!cluster) return;

    pushSnapshot();

    // Convert the screen drop position to flow canvas coordinates.
    // Offset so the note is centred horizontally and anchored near the cursor.
    const canvasPos = sfpRef.current({ x: e.clientX, y: e.clientY });
    const position: XYPosition = { x: canvasPos.x - 120, y: canvasPos.y - 20 };

    const newNote: NoteFlowNode = {
      id: crypto.randomUUID(),
      type: "noteCard",
      position,
      data: { body: note.body, colorKey: note.colorKey, formatting: note.formatting },
    };

    const remaining = cluster.data.notes.filter((n) => n.id !== note.id);

    setNodes((nds) => {
      const withoutCluster = nds.filter((n) => n.id !== cluster.id);
      if (remaining.length === 0) {
        // Cluster is empty — remove it, place just the note.
        return [...withoutCluster, newNote];
      }
      // Keep the cluster (without the dragged note), add the loose note.
      const updatedCluster: ClusterFlowNode = {
        ...cluster,
        data: {
          ...cluster.data,
          notes: remaining,
          colorKey: remaining[0]?.colorKey ?? DEFAULT_NOTE_COLOR,
        },
      };
      return [...withoutCluster, updatedCluster, newNote];
    });

    // Explicitly clear the ClusterPanel ghost. dragend is unreliable when the
    // drag source unmounts before it fires (e.g. when the cluster is deleted).
    clearClusterGhostRef.current();
  }, [pushSnapshot, setNodes]);

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

  // ── Clear board ───────────────────────────────────────────────────────────
  const handleClearBoard = useCallback(() => {
    if (!window.confirm("Clear this board? All notes and connections will be removed.")) return;
    setNodes([]);
    setEdges([]);
    setColorLabels({});
    setCategoryFilterColor(null);
    undoStack.current = [];
    redoStack.current = [];
    setCanUndo(false);
    setCanRedo(false);
    setResetViewportSignal((s) => s + 1);
    viewportRef.current = DEFAULT_VIEWPORT;
    saveBoardState(boardId, {
      nodes: [],
      edges: [],
      viewport: DEFAULT_VIEWPORT,
      colorLabels: {},
    });
    closeSearch();
  }, [boardId, setNodes, setEdges, setColorLabels, setCanUndo, setCanRedo, closeSearch]);

  const handleColorLabelUpdate = useCallback(
    (key: NoteColorKey, label: string | null) => {
      pushSnapshot();
      const removing = label === null || label.trim() === "";
      if (removing) {
        setCategoryFilterColor((prev) => (prev === key ? null : prev));
      }
      setColorLabels((prev) => {
        const next = { ...prev };
        if (removing) delete next[key];
        else next[key] = label.trim();
        return next;
      });
    },
    [pushSnapshot],
  );

  const undoContextValue = useMemo(() => ({ pushSnapshot }), [pushSnapshot]);

  return (
    <UndoContext.Provider value={undoContextValue}>
      <SearchContext.Provider value={searchSessionValue}>
      <CategoryFilterContext.Provider value={searchOpen ? null : categoryFilterColor}>
      <div
        className="flex h-full w-full flex-col bg-white dark:bg-neutral-900"
        data-connecting={connecting ? "true" : undefined}
        onClick={contextMenu ? closeContextMenu : undefined}
        onContextMenu={contextMenu ? (e) => { e.preventDefault(); closeContextMenu(); } : undefined}
        onDragOver={handleCanvasDragOver}
        onDrop={handleCanvasDrop}
      >
        <div className="relative min-h-0 flex-1">
          <ReactFlow
            data-corkboard-react-flow=""
            className="h-full w-full touch-manipulation"
            colorMode="system"
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
          onMoveEnd={onMoveEnd}
          defaultViewport={defaultViewport}
          minZoom={0.15}
          maxZoom={2}
          connectionMode={ConnectionMode.Loose}
          connectionLineType={ConnectionLineType.Straight}
          deleteKeyCode={null}
          defaultEdgeOptions={{ type: "boardEdge" }}
          multiSelectionKeyCode={["Meta", "Control"]}
          selectionMode={SelectionMode.Partial}
          selectionOnDrag={canvasTool === "select"}
          panOnDrag={canvasTool === "select" ? [1, 2] : true}
          selectionKeyCode={canvasTool === "select" ? null : "Shift"}
        >
          <Toolbar
            canvasTool={canvasTool}
            onCanvasToolChange={setCanvasTool}
            connecting={connecting}
            onToggleConnecting={toggleConnecting}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            searchOpen={searchOpen}
            onOpenSearch={openSearch}
            boardTitle={boardTitle}
            workspaceFile={workspaceFile}
            onClearBoard={handleClearBoard}
            colorKey={toolbarColorKey}
            formatting={toolbarFormatting}
            onChangeColor={handleToolbarColor}
            onChangeFontSize={handleToolbarFontSize}
            onToggleFormat={handleToolbarToggleFormat}
            canCreateCluster={canCreateCluster}
            onCreateCluster={handleToolbarCreateCluster}
            canDelete={!!(selectedCanvasNodes.length > 0 || selectedPanelNote)}
            onDeleteSelected={handleToolbarDelete}
            defaultColorKey={defaultSettings.colorKey}
          />
          <Background gap={18} size={1} className="opacity-40" />
          <Controls />
          <ViewportResetter signal={resetViewportSignal} />
          <SFPCapture sfpRef={sfpRef} />
          <BoardUserSelectionPointerFlush />
          <BoardSearchBar
            open={searchOpen}
            inputValue={searchInput}
            onInputChange={setSearchInput}
            onClose={closeSearch}
            matchesLength={searchMatches.length}
            activeIndex={searchActiveIndex}
            onNext={goSearchNext}
            onPrev={goSearchPrev}
            debouncedQuery={debouncedSearchQuery}
          />
          <SearchMatchViewport
            open={searchOpen}
            debouncedQuery={debouncedSearchQuery}
            matches={searchMatches}
            activeIndex={searchActiveIndex}
            onClusterInternalActive={onSearchClusterInternalActive}
            onCollapseClusters={onSearchCollapseClusters}
          />
        </ReactFlow>

        {/* Cluster side panel */}
        {expandedCluster && (
          <ClusterPanel
            clusterId={expandedCluster.id}
            notes={expandedCluster.data.notes}
            onUpdateNote={handleUpdateNote}
            onDeleteNote={handleDeleteNote}
            onEjectNote={handleEjectNote}
            onAddNote={handleAddNote}
            onClose={handleClosePanel}
            onDeleteCluster={handleDeleteCluster}
            onUncluster={handleUncluster}
            onReorderNotes={handleReorderNotes}
            clearGhostRef={clearClusterGhostRef}
            selectedNoteId={selectedPanelNoteId}
            onSelectNote={handleSelectPanelNote}
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

        <ColorLegend
          colorLabels={colorLabels}
          onUpdateLabel={handleColorLabelUpdate}
          filterColor={categoryFilterColor}
          onToggleFilter={toggleCategoryFilter}
          filterSuspended={searchOpen && categoryFilterColor != null}
        />
      </div>
      </CategoryFilterContext.Provider>
      </SearchContext.Provider>
    </UndoContext.Provider>
  );
}

// ── Board (outer shell) ───────────────────────────────────────────────────────
// Manages the list of boards, the active board, and the bottom tab bar.
// Uses `${activeId}-${canvasKeyNonce}` on BoardCanvas so React remounts when switching boards
// or after a workspace JSON import (same tab id, new localStorage payload).

export function Board() {
  const [boards, setBoards] = useState<BoardMeta[]>(() => {
    const meta = loadBoardsMeta();
    if (meta.length > 0) return meta;
    const firstId = crypto.randomUUID();
    const initial: BoardMeta[] = [{ id: firstId, title: "Board 1" }];
    saveBoardsMeta(initial);
    return initial;
  });

  const [activeId, setActiveId] = useState<string>(() => {
    const savedActive = loadActiveBoard();
    // Only restore if the board still exists.
    if (savedActive && boards.some((b) => b.id === savedActive)) return savedActive;
    return boards[0].id;
  });

  const [canvasKeyNonce, setCanvasKeyNonce] = useState(0);
  const importWorkspaceInputRef = useRef<HTMLInputElement>(null);

  const persistBoards = useCallback((next: BoardMeta[]) => {
    setBoards(next);
    saveBoardsMeta(next);
  }, []);

  const switchTo = useCallback((id: string) => {
    setActiveId(id);
    saveActiveBoard(id);
  }, []);

  const handleAdd = useCallback(() => {
    if (boards.length >= WORKSPACE_MAX_BOARDS) return;
    // Pick the lowest unused "Board N" number.
    const used = new Set(
      boards.map((b) => { const m = b.title.match(/^Board (\d+)$/); return m ? +m[1] : 0; }),
    );
    let n = 1;
    while (used.has(n)) n++;
    const newId = crypto.randomUUID();
    const next: BoardMeta[] = [...boards, { id: newId, title: `Board ${n}` }];
    persistBoards(next);
    switchTo(newId);
  }, [boards, persistBoards, switchTo]);

  const handleDelete = useCallback((id: string) => {
    const board = boards.find((b) => b.id === id);
    if (!board) return;
    if (!window.confirm(`Delete "${board.title}"? This cannot be undone.`)) return;
    deleteBoardState(id);
    let next = boards.filter((b) => b.id !== id);
    if (next.length === 0) {
      const newId = crypto.randomUUID();
      next = [{ id: newId, title: "Board 1" }];
    }
    persistBoards(next);
    if (id === activeId) switchTo(next[0].id);
  }, [boards, activeId, persistBoards, switchTo]);

  const handleRename = useCallback((id: string, title: string) => {
    persistBoards(boards.map((b) => (b.id === id ? { ...b, title } : b)));
  }, [boards, persistBoards]);

  const handleReorder = useCallback((next: BoardMeta[]) => {
    persistBoards(next);
  }, [persistBoards]);

  const tryImportWorkspaceJsonText = useCallback((text: string) => {
    if (
      !window.confirm(
        "Replace the entire workspace? All current boards and notes will be removed and replaced by this file. This cannot be undone.",
      )
    ) {
      return;
    }
    const parsed = parseWorkspaceImportJson(text);
    if (!parsed.ok) {
      window.alert(parsed.error);
      return;
    }
    try {
      const r = applyWorkspaceImport(parsed.doc);
      setBoards(r.boards);
      setActiveId(r.activeId);
      setCanvasKeyNonce((n) => n + 1);
    } catch (e) {
      console.error(e);
      window.alert("Could not apply this workspace file.");
    }
  }, []);

  const handleExportWorkspaceJson = useCallback(() => {
    try {
      downloadWorkspaceJson();
    } catch (e) {
      console.error(e);
      window.alert("Could not export the workspace.");
    }
  }, []);

  const workspaceFile = useMemo<WorkspaceFileMenuActions>(
    () => ({
      onExportWorkspaceJson: handleExportWorkspaceJson,
      onRequestImportWorkspaceJson: () => importWorkspaceInputRef.current?.click(),
    }),
    [handleExportWorkspaceJson],
  );

  const handleImportWorkspaceInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      const text = await file.text();
      tryImportWorkspaceJsonText(text);
    },
    [tryImportWorkspaceJsonText],
  );

  const handleWorkspaceDragOverCapture = useCallback((e: React.DragEvent) => {
    if ([...e.dataTransfer.types].includes("Files")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const handleWorkspaceDropCapture = useCallback(
    async (e: React.DragEvent) => {
      const file = e.dataTransfer.files?.[0];
      if (!file || !file.name.toLowerCase().endsWith(".json")) return;
      if ([...e.dataTransfer.types].includes("application/x-corkboard-note")) return;
      e.preventDefault();
      e.stopPropagation();
      const text = await file.text();
      tryImportWorkspaceJsonText(text);
    },
    [tryImportWorkspaceJsonText],
  );

  return (
    <div
      className="flex h-dvh w-full flex-col"
      onDragOverCapture={handleWorkspaceDragOverCapture}
      onDropCapture={handleWorkspaceDropCapture}
    >
      <input
        ref={importWorkspaceInputRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={handleImportWorkspaceInputChange}
      />
      <div className="min-h-0 flex-1">
        <BoardCanvas
          key={`${activeId}-${canvasKeyNonce}`}
          boardId={activeId}
          boardTitle={boards.find((b) => b.id === activeId)?.title ?? "Board"}
          workspaceFile={workspaceFile}
        />
      </div>
      <BoardTabs
        boards={boards}
        activeId={activeId}
        onSwitch={switchTo}
        onAdd={handleAdd}
        onDelete={handleDelete}
        onRename={handleRename}
        onReorder={handleReorder}
      />
    </div>
  );
}
