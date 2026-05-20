// Workspace-level JSON export/import (all boards). Matches SPEC envelope:
// { version, exportedAt, boards[] }.

import {
  loadBoardsMeta,
  loadBoardState,
  saveBoardsMeta,
  saveBoardState,
  saveActiveBoard,
  deleteBoardState,
  normalizeImportedBoardState,
  type BoardMeta,
  type PersistedBoardState,
} from "@/lib/persistence";

/** Must stay aligned with the tab bar limit in `BoardTabs`. */
export const WORKSPACE_MAX_BOARDS = 8;

export const WORKSPACE_JSON_VERSION = 1;

/** One tab + full persisted canvas payload (same shape written to `corkboard:board:{id}`). */
export type WorkspaceBoardSnapshot = BoardMeta & PersistedBoardState;

export type WorkspaceExportDocument = {
  version: number;
  exportedAt: string;
  boards: WorkspaceBoardSnapshot[];
};

const EMPTY_BOARD: PersistedBoardState = {
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
};

/** Build a snapshot from `corkboard:boards` plus every `corkboard:board:{id}` key. */
export function gatherWorkspaceExport(): WorkspaceExportDocument {
  const meta = loadBoardsMeta();
  const boards: WorkspaceBoardSnapshot[] = meta.map((m) => {
    const state = loadBoardState(m.id) ?? EMPTY_BOARD;
    return { ...m, ...state };
  });
  return {
    version: WORKSPACE_JSON_VERSION,
    exportedAt: new Date().toISOString(),
    boards,
  };
}

export function workspaceJsonFilename(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `corkboard-workspace ${stamp}.json`;
}

export function downloadWorkspaceJson(): void {
  const doc = gatherWorkspaceExport();
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = workspaceJsonFilename();
  a.rel = "noopener";
  a.click();
  URL.revokeObjectURL(url);
}

function readMetaFromBoardRaw(raw: unknown): { id: string; title: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id.trim()) return null;
  const title = typeof o.title === "string" ? o.title.trim() : "";
  return { id: o.id.trim(), title: title.length > 0 ? title : "Untitled board" };
}

export function parseWorkspaceImportJson(
  text: string,
): { ok: true; doc: WorkspaceExportDocument } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "The file is not valid JSON." };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "The file must contain a JSON object." };
  }
  const root = parsed as Record<string, unknown>;

  const rawVersion = root.version;
  const version =
    rawVersion === undefined || rawVersion === null ? 1 : Number(rawVersion);
  if (!Number.isInteger(version) || version < 1) {
    return { ok: false, error: 'Missing or invalid workspace "version" field.' };
  }
  if (version !== WORKSPACE_JSON_VERSION) {
    return {
      ok: false,
      error: `Unsupported workspace format version (${version}). This app only imports version ${WORKSPACE_JSON_VERSION}.`,
    };
  }

  if (!Array.isArray(root.boards)) {
    return { ok: false, error: 'Missing or invalid "boards" array.' };
  }
  if (root.boards.length < 1) {
    return { ok: false, error: "The workspace must contain at least one board." };
  }
  if (root.boards.length > WORKSPACE_MAX_BOARDS) {
    return {
      ok: false,
      error: `This file has ${root.boards.length} boards; Big Corkboard supports at most ${WORKSPACE_MAX_BOARDS} per workspace.`,
    };
  }

  const boards: WorkspaceBoardSnapshot[] = [];
  const seenIds = new Set<string>();
  for (let i = 0; i < root.boards.length; i++) {
    const rawBoard = root.boards[i];
    const meta = readMetaFromBoardRaw(rawBoard);
    if (!meta) {
      return { ok: false, error: `Board ${i + 1} is missing a valid string "id".` };
    }
    if (seenIds.has(meta.id)) {
      return { ok: false, error: `Duplicate board id "${meta.id}".` };
    }
    seenIds.add(meta.id);
    const state = normalizeImportedBoardState(rawBoard);
    boards.push({ ...meta, ...state });
  }

  const exportedAt =
    typeof root.exportedAt === "string" && root.exportedAt.trim()
      ? root.exportedAt.trim()
      : new Date().toISOString();

  return {
    ok: true,
    doc: {
      version: WORKSPACE_JSON_VERSION,
      exportedAt,
      boards,
    },
  };
}

/** Replace every board key and tab list in localStorage; returns state for React. */
export function applyWorkspaceImport(doc: WorkspaceExportDocument): {
  boards: BoardMeta[];
  activeId: string;
} {
  const oldMeta = loadBoardsMeta();
  for (const b of oldMeta) {
    deleteBoardState(b.id);
  }
  const meta: BoardMeta[] = doc.boards.map(({ id, title }) => ({ id, title }));
  saveBoardsMeta(meta);
  for (const b of doc.boards) {
    const { id, title: _title, ...state } = b;
    saveBoardState(id, {
      nodes: state.nodes,
      edges: state.edges,
      viewport: state.viewport,
      colorLabels: state.colorLabels,
    });
  }
  const activeId = meta[0].id;
  saveActiveBoard(activeId);
  return { boards: meta, activeId };
}
