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
| **Polish** | Anything that tightens UX without requiring sync — iterate as small issues. |

### Work items (living checklist)

Use this list for planning issues/PRs; reorder as priorities shift.

- [ ] **Color legend** — Bottom strip (above board tabs): swatch + label per color that has a name; “assign category” for unused colors; click chip to rename/clear. Data field `colorLabels` on board already exists in the model spec.  
- [ ] **Filter by color** — From legend: dim non-matching notes/clusters; clear on `Escape` or second click.  
- [ ] **Neon / vivid palette** — Second color set for notes; works with dark canvas; decision: global vs per-board toggle.  
- [ ] **Search** — Overlay from toolbar; full-text on canvas + cluster-internal notes; highlight matches; no auto-pan.  
- [ ] **Export PNG** — `html-to-image` (or similar): “current viewport” and “fit all nodes then capture”; filename from board title.  
- [ ] **Export / import JSON** — Download board state; file pick or drop to restore (define conflict behavior: replace board vs merge TBD).  

Items marked “v2” in [SPEC.md](./SPEC.md) under *Search*, *Export*, *Color labels*, and *Neon palette* roll up here.

---

## v3 — planned

Backend + heavier client features: **image nodes** (IndexedDB locally, Supabase Storage when synced), **cloud sync** (Supabase auth, last-write-wins per board for solo v3), **user-defined colors/themes**, **Capacitor** mobile shell + touch polish, possible **nested corkboards**. See [SPEC.md](./SPEC.md) sections *Image nodes*, *Cloud sync*, *Mobile*.

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
