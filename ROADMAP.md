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

## v2 — shipped

**Live:** [bigcorkboard.com](https://bigcorkboard.com) (same deployment as v1; existing users upgrade in place via browser storage)

**Theme:** More useful and polished **without a backend** — categories, search, export, nested clusters, resize, and canvas polish. Workspace JSON export/import for manual project switching until v3 desktop save files.

### Completed milestones (checklist)

- [x] Color legend + filter by color  
- [x] Eight-color theme-aware palette (legacy six-color keys migrate on load)  
- [x] Board search (`Cmd/Ctrl+F`) with cluster panel integration  
- [x] Export PNG (viewport + fit all)  
- [x] Export / import workspace JSON  
- [x] Multi-select + bulk toolbar actions  
- [x] Nested clusters (max depth 1)  
- [x] Note + cluster resize, **Fit**, drag-to-place new note/cluster  
- [x] Cluster front-card formatting + double-click inline edit  

### Open questions (defer — revisit before big UI changes)

- [ ] **Cluster panel vs canvas note sizing** — Inner notes persist per-note `width` / `height`; the collapsed cluster on canvas uses the **top** note’s dimensions, but panel rows use a separate full-width list layout (`resize-y` textarea, not stored size). Correct data model, but the mismatch can confuse at first. Options for a future pass: panel cards at stored size, resize in panel, or an intentional “list editor vs canvas preview” split with clearer affordances. Needs product discussion before a larger cluster-panel redesign.
- [ ] **Default note sizing mode** — v2 uses **fixed** default cards + scroll + manual resize + **Fit**. Future **app preference**: auto-grow height while typing (min = default) vs fixed boxes. Needs per-note **fixed** override after manual resize; global toggle sets default for new notes only (or optional bulk apply). See [SPEC.md — Default note sizing mode (open)](./SPEC.md#default-note-sizing-mode-open).

Historical v2 scope table and polish issue links: [SPEC.md](./SPEC.md). Link GitHub issue numbers in PR descriptions if you want a single index.

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
