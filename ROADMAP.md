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

### Scope

| Area | Intent |
|------|--------|
| **Categories** | Per-board color labels + legend UI; optional “filter by this color” on the canvas. |
| **Palette** | Second note color set (e.g. neon) tuned for dark canvas; user or per-board choice TBD. |
| **Search** | `Cmd/Ctrl+F` (or equivalent) on the **active board** only; highlight matches; no cross-board search in v2. |
| **Export** | PNG (current view + fit-all) and JSON backup/import for the current board. |
| **Nested clusters** | **One level only:** cluster-on-cluster on canvas (dialog: flatten vs nest vs cancel); panel shows children as **indented** rows; optional panel tree-DnD later. Deeper hierarchy → **nested corkboards (v3)**. |
| **Polish** | Small UX wins that don’t warrant their own row — track as individual GitHub issues. |

### Work items (living checklist)

Use this list for planning issues/PRs; reorder as priorities shift.

- [ ] **Color legend** — Bottom strip (above board tabs): swatch + label per color that has a name; “assign category” for unused colors; click chip to rename/clear. Data field `colorLabels` on board already exists in the model spec.  
- [ ] **Filter by color** — From legend: dim non-matching notes/clusters; clear on `Escape` or second click.  
- [ ] **Neon / vivid palette** — Second color set for notes; works with dark canvas; decision: global vs per-board toggle.  
- [ ] **Search** — Overlay from toolbar; full-text on canvas + cluster-internal notes; highlight matches; no auto-pan.  
- [ ] **Export PNG** — `html-to-image` (or similar): “current viewport” and “fit all nodes then capture”; filename from board title.  
- [ ] **Export / import JSON** — Download board state; file pick or drop to restore (define conflict behavior: replace board vs merge TBD).  
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

Backend + heavier client features: **image nodes** (IndexedDB locally, Supabase Storage when synced), **cloud sync** (Supabase auth, last-write-wins per board for solo v3), **user-defined colors/themes**, **Capacitor** mobile shell + touch polish, and **nested corkboards** (sub-board–level hierarchy — distinct from **v2 one-level nested clusters**, see [SPEC.md](./SPEC.md)). See [SPEC.md](./SPEC.md) sections *Image nodes*, *Cloud sync*, *Mobile*.

---

## v4 — planned

Collaboration: shareable read-only links, real-time co-editing, full-text search across all boards.

---

## How these docs fit together

| Doc | Purpose |
|-----|---------|
| **README.md** | Short pitch, live link, **how to use** the app, where data lives, minimal contributor pointers. |
| **SPEC.md** | Goals, mental model, data model, tech stack, design decisions, future (v2–v4) intent, dev setup. |
| **ROADMAP.md** (this file) | What shipped, what’s next, checklists by version. |

When a version ships, update the intro in **README** if user-facing behavior changes, sync **SPEC** / **ROADMAP** milestones, and tick items here.
