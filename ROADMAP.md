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

**Theme:** More useful and polished **without a backend** — categories, search, export, nested clusters, resize, and canvas polish. Workspace export/import for manual project switching until v3 desktop save files.

### Completed milestones (checklist)

- [x] Color legend + filter by color  
- [x] Eight-color theme-aware palette (legacy six-color keys migrate on load)  
- [x] Board search (`Cmd/Ctrl+F`) with cluster panel integration  
- [x] Export PNG (viewport + fit all)  
- [x] Export / import workspace (`.corkboard`, JSON inside — see [SPEC.md](./SPEC.md))  
- [x] Multi-select + bulk toolbar actions  
- [x] Nested clusters (max depth 1)  
- [x] Note + cluster resize, **Fit**, drag-to-place new note/cluster  
- [x] Cluster front-card formatting + double-click inline edit  

Historical v2 scope table and polish issue links: [SPEC.md](./SPEC.md). Link GitHub issue numbers in PR descriptions if you want a single index.

---

## v3 — planned

**Scope:** **Desktop only.** v2 is feature-complete for the original corkboard concept; v3 ships that experience as a **local save-file app**. No new canvas features in v3.

**Primary deliverable:** **Desktop app** (workspace = save file on disk) — **Tauri**-wrapped Next/React, with **New / Open / Save / Save as**, **recent files**, and **debounced auto-save** to the filesystem.

**Save file:** One workspace ↔ one **`.corkboard`** file (UTF-8 JSON inside). Envelope **`version: 2`** — same document shape as v2 export, with a bumped version number reflecting the full v2 node schema (nested clusters, dimensions, `colorLabels`, etc.). See [SPEC.md — Workspace save file format](./SPEC.md#workspace-save-file-format).

**Web build (bigcorkboard.com):** stays **`localStorage`** + current UX; honest copy about browser-stored data; **`.corkboard` export/import** as backup and portability; **no cloud sync** in v3.

**Explicitly not v3:** optional **personal** cloud sync, **image nodes**, **user-defined colors/themes**, **nested corkboards**, app preferences (auto-grow notes, cluster-panel sizing polish), and other UI/feature expansions — all **v4+**. **Phone** is not a target; **tablet** remains post–desktop (see [SPEC.md — Mobile](./SPEC.md#mobile)).

### v3 checklist (living)

- [ ] Persistence abstraction (web `localStorage` vs desktop filesystem)  
- [ ] Tauri app shell + dev workflow  
- [ ] New / Open / Save / Save as / recent files  
- [ ] Auto-save to disk (debounced)  
- [ ] `.corkboard` as the canonical extension on desktop and in the web File menu  
- [ ] Web copy: browser storage vs desktop save file  

---

## v4+ — planned

**Optional personal cloud sync** (e.g. **Supabase**): opt-in, **last-write-wins per workspace**, solo-focused; app remains fully usable offline without an account. **Collaboration** (shareable workspaces, real-time co-editing) is a **separate** track — not bundled with first sync.

**Feature track (deferred from v3):**

- **Image nodes** — canvas objects with drag/connect/pin; blob storage strategy TBD (IndexedDB on web, embedded or sidecar with save file on desktop). See [SPEC.md — Image nodes (v4+)](./SPEC.md#image-nodes-v4).
- **User-defined colors and themes** — custom hex per note, custom board backgrounds, full palette control.
- **Nested corkboards** — sub-board scope (distinct from [v2 nested clusters](./SPEC.md#nested-clusters-v2)); needs a dedicated design pass before implementation.
- **App preferences** — e.g. default note sizing mode (fixed vs auto-grow), cluster panel vs canvas sizing polish. See [SPEC.md — Default note sizing mode (open)](./SPEC.md#default-note-sizing-mode-open) and open questions below.

Other long-hanging fruit (examples): shareable read-only links, **cross-board / cross-workspace search** if product still wants it.

### Open questions (defer to v4+)

- [ ] **Cluster panel vs canvas note sizing** — Inner notes persist per-note `width` / `height`; the collapsed cluster on canvas uses the **top** note’s dimensions, but panel rows use a separate full-width list layout. Correct data model, but the mismatch can confuse. Options: panel cards at stored size, resize in panel, or clearer “list editor vs canvas preview” affordances.
- [ ] **Default note sizing mode** — v2 uses **fixed** default cards + scroll + manual resize + **Fit**. Future **app preference**: auto-grow height while typing (min = default) vs fixed boxes; per-note **fixed** override after manual resize.

---

## How these docs fit together

| Doc | Purpose |
|-----|---------|
| **README.md** | Short pitch, live link, **how to use** the app, where data lives, minimal contributor pointers. |
| **SPEC.md** | Goals, mental model, data model, tech stack, design decisions, future (v3–v4+) intent, dev setup. |
| **ROADMAP.md** (this file) | What shipped, what’s next, checklists by version. |

When a version ships, update the intro in **README** if user-facing behavior changes, sync **SPEC** / **ROADMAP** milestones, and tick items here.
