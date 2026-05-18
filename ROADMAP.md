# Big Corkboard — roadmap

This file tracks **shipping phases** and concrete work. Product intent, data model, and deep design notes stay in [SPEC.md](./SPEC.md). End-user “how to use” stays in [README.md](./README.md).

---

## v1 — shipped

**Live:** [bigcorkboard.com](https://bigcorkboard.com)

Local-first corkboard: infinite canvas, standalone notes and clusters, optional connections, undo/redo, multiple boards (tabs, max 8), debounced `localStorage` persistence, drag-to-pin, drag-out from the cluster panel, connection mode with edge direction menu, and look-and-feel polish.

### Completed milestones (historical checklist)

1. Canvas + note nodes  
2. Selection / formatting controls (toolbar-driven in current UI)  
3. Cluster nodes + side panel  
4. Drag-to-pin onto clusters and notes  
5. Connections (edges), connection mode, direction via context menu  
6. Undo / redo  
7. Persistence (`corkboard:boards`, `corkboard:board:{id}`, active board)  
8. Multiple boards (tabs, rename, reorder, delete)  
9. Drag-out from cluster panel to canvas  
10. Look-and-feel improvements  

---

## v2 — in progress

**Theme:** More useful and polished **without a backend** — still local / client-only unless a feature explicitly adds something like optional export-only flows.

**Product framing:** The tabbed boards in the UI are one **workspace** (one project). v2 **JSON export/import** is scoped to the **whole workspace** so it doubles as the manual “switch project” path until v3 desktop save files ship. See [SPEC.md — Workspaces vs boards](./SPEC.md#workspaces-vs-boards) and [Export (v2)](./SPEC.md#export-v2).

### Scope

| Area | Intent |
|------|--------|
| **Categories** | Per-board color labels + legend UI; **filter by color** on the canvas (dim non-matches). |
| **Palette** | **Eight** unified, high-contrast note colors with **light/dark** surfaces (no separate user “theme” pick); see `noteColors.ts`. |
| **Search** | `Cmd/Ctrl+F` on the **active board** only: floating bar, cycling, pan/zoom-to-readable for the active hit, cluster panel integration, color-filter suspend while open. No cross-board search in v2. See [SPEC.md](./SPEC.md#search-v2). |
| **Export** | **PNG:** current view + fit-all. **JSON:** versioned snapshot of **all boards in the workspace**; import **replaces** the in-memory workspace after confirmation (no merge in v2). Same envelope becomes the v3 desktop save file. See [SPEC.md — Export (v2)](./SPEC.md#export-v2). |
| **Nested clusters** | **One level only:** cluster-on-cluster on canvas (dialog: flatten vs nest vs cancel); panel shows children as **indented** rows; optional panel tree-DnD later. Deeper hierarchy → **nested corkboards (v3)**. |
| **Polish** | Small UX wins that don’t warrant their own row — track as individual GitHub issues. |

### Work items (living checklist)

Use this list for planning issues/PRs; reorder as priorities shift.

- [x] **Color legend** — Bottom strip (above board tabs): swatch + label per color that has a name; “assign category” for unused colors; click chip to rename/clear. Data field `colorLabels` on board already exists in the model spec.  
- [x] **Filter by color** — Legend swatch: dim non-matching notes, clusters, edges, and cluster-panel rows; clear on `Escape`, **Clear filter**, or second click on the active swatch.  
- [x] **Note palette** — Eight theme-aware colors (light + dark card surfaces, label-tint handles/rings); legacy six-color keys migrate on load.  
- [x] **Search** — [SPEC.md — Search (v2)](./SPEC.md#search-v2): floating top-center bar (non-modal), debounced query, match rings + dim non-matches, cycle with wrap, smart pan/zoom for active match, cluster-internal stops + panel, color filter suspended while open.
- [x] **Export PNG** — `html-to-image` (or similar): “current viewport” and “fit all nodes then capture”; default filename from board title + timestamp.  
- [x] **Export / import JSON** — Versioned `{ version, exportedAt, boards[] }` for **all boards in the workspace**; file pick or drop; v2 conflict behavior **replace workspace** with explicit overwrite warning (manual project switch). **Implementation:** persistence uses split `localStorage` keys (`corkboard:boards` + per-board `corkboard:board:{id}`); the exporter must **gather every board** into one snapshot, not only the active board’s in-memory state. Same format = v3 save file per [SPEC.md](./SPEC.md#desktop-application-and-save-files-v3).  
- [ ] **Multi-select & bulk actions** — Not polish: new interaction model + toolbar/cluster behavior. Tie to your GitHub issues as you open/close them.  
  - **Selection:** additive select with **Ctrl/Cmd+click**; optional **marquee / drag-rectangle** (likely gated behind a **Select** mode or modifier so it doesn’t fight pan/drag on the canvas).  
  - **Bulk color & formatting:** apply to every selected **note** (and define rules for **clusters** — e.g. front-card color only vs whole cluster).  
  - **Bulk move:** drag the selection so all selected nodes move together (single undo step).  
  - **Bulk cluster:** combine selected canvas items into **one** cluster (semantics when selection includes clusters — align with nested-cluster rules in [SPEC.md](./SPEC.md)).  
- [ ] **Nested clusters (max depth 1)** — Data model + canvas drop (cluster → cluster) + dialog (**Flatten** | **Nest** | **Cancel**); panel **indented** tree UI; enforce **no cluster inside a child cluster**. Optional: panel DnD as folder tree. Spec: [SPEC.md](./SPEC.md) *Nested clusters*.  

### Polish & small UX (v2 backlog)

Smaller wins; link GitHub issues inline when you have them (e.g. `(#123)`).

- [ ] **Note resize** — Drag handle(s) on canvas notes to set **width/height** independent of body length (sensible min/max, persist on `noteCard`, edges/handles stay coherent). [#25](https://github.com/dixiuseb/big-corkboard/issues/25)
- [ ] **Drag-to-place new note** — Click-drag from **Add note** to spawn a card at drop position (ghost while dragging, cancel if released off-canvas). Moderate interaction work but still **client-only**; low priority vs larger v2 items — **not** inherently a v3 feature unless you batch it with unrelated work. [#26](https://github.com/dixiuseb/big-corkboard/issues/26)

Planned v2 **search / export / categories / palette** detail: [SPEC.md](./SPEC.md). Link GitHub issue numbers in PR descriptions or inline here if you want a single index.

---

## v3 — planned

**Primary deliverable:** **Desktop app** (workspace = save file on disk) — **Tauri**-wrapped Next/React, with **New / Open / Save / Save as**, **recent files**, and **debounced auto-save** to the filesystem. The **v2 JSON document** is the on-disk format (e.g. `.corkboard`); no second schema.

**Web build (bigcorkboard.com):** stays **`localStorage`** + current UX; honest copy about browser-stored data; **JSON export/import** as backup and portability; **no cloud sync** in v3.

**Also in v3 (feature track, not blocked on sync):** **image nodes** (IndexedDB on web; consistent with workspace file on desktop), **user-defined colors/themes**, and **nested corkboards** (sub-board scope — distinct from [v2 nested clusters](./SPEC.md)). See [SPEC.md](./SPEC.md) *Image nodes*, *Desktop application and save files*, *Nested corkboards*.

**Explicitly not v3:** optional **personal** cloud sync (moved to v4+). **Phone** is not a target; **tablet** remains post–desktop (see [SPEC.md — Mobile](./SPEC.md#mobile)).

---

## v4+ — planned

**Optional personal cloud sync** (e.g. **Supabase**): opt-in, **last-write-wins per workspace**, solo-focused; app remains fully usable offline without an account. **Collaboration** (shareable workspaces, real-time co-editing) is a **separate** track — not bundled with first sync.

Other long-hanging fruit (examples): shareable read-only links, **cross-board / cross-workspace search** if product still wants it.

---

## How these docs fit together

| Doc | Purpose |
|-----|---------|
| **README.md** | Short pitch, live link, **how to use** the app, where data lives, minimal contributor pointers. |
| **SPEC.md** | Goals, mental model, data model, tech stack, design decisions, future (v2–v4+) intent, dev setup. |
| **ROADMAP.md** (this file) | What shipped, what’s next, checklists by version. |

When a version ships, update the intro in **README** if user-facing behavior changes, sync **SPEC** / **ROADMAP** milestones, and tick items here.
