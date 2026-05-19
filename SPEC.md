# Big Corkboard — specification

This document is the **technical and product design spec** for contributors, agents, and anyone implementing features. **How to use the app** (end-user) lives in [README.md](./README.md). **What shipped and what’s next** lives in [ROADMAP.md](./ROADMAP.md).

---

## Goals

- **Capture ideas where they land.** Notes and clusters coexist anywhere on the board; nothing forces a folder tree mindset.
- **Feel like a real corkboard.** Stacked cards, color at a glance, optional connections that stay unobtrusive until you need them.
- **Ship in focused versions** — v1 leaned on React Flow for pan/zoom/drag/connect and prioritized note UX, clusters, and local persistence; v2 adds search, export, and category polish without a backend ([roadmap](./ROADMAP.md)).
- **Desktop-first from v3 onward** — the primary product is a local save-file workspace on disk (packaged with **Tauri**); the public web build stays useful as a demo and fallback with browser storage and JSON portability. Optional **personal** cloud sync is explicitly **v4+**, not a gate for desktop shipping.

## Mental model

One infinite canvas: **standalone notecards** and **expandable cluster-nodes** can live side by side. Connections between items are optional.

### Workspaces vs boards

The **board tabs** in the UI (up to eight per session) are all part of a single **workspace** — one project or creative context (e.g. one novel, one screenplay). That boundary is intentional.

Switching between **unrelated** projects is **not** “another tab”: it is a **workspace** change. v2 **JSON export/import** carries the whole workspace so users can move projects manually; v3 **save files** map one workspace ↔ one file on disk. Preserve this distinction in persistence, export, and any future sync UX.

State is persisted **locally first**; the on-disk / export JSON shape is versioned so optional cross-device sync (v4+) can layer on without rewriting the core model.

## Data model

```ts
type Color = 'iris' | 'sky' | 'spearmint' | 'fern' | 'marigold' | 'terracotta' | 'rose' | 'stone'

// Formatting applies to the entire note body — no inline / rich-text ranges.
// This keeps the data model simple and avoids a contenteditable editor.
type FontSize = 'sm' | 'md' | 'lg' | 'xl'  // defaults to 'md'

type Formatting = {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  fontSize?: FontSize
}

type NoteCard = {
  id: string
  type: 'card'
  body: string
  color: Color
  formatting?: Formatting
  width?: number   // optional; canvas note body width (px)
  height?: number  // optional; canvas note body height (px)
  position: { x: number; y: number }
}

// No separate title field — the first note in the cluster acts as the title card.
type ClusterNode = {
  id: string
  type: 'cluster'
  color: Color
  position: { x: number; y: number }
  notes: NoteCard[]  // notes live inside the cluster, not on the canvas
}

// Renamed from Connection to avoid collision with React Flow's Connection type.
type BoardEdge = {
  id: string
  source: string  // node id (note or cluster)
  target: string  // node id (note or cluster)
  label?: string
  direction: 'none' | 'forward' | 'reverse' | 'both'
}

type Board = {
  id: string
  title: string
  nodes: (NoteCard | ClusterNode)[]
  edges: BoardEdge[]
  viewport: { x: number; y: number; zoom: number }
  // User-defined label per color (e.g. iris → "Characters", sky → "Scenes").
  // Omitted colors have no label. UI reads this to render the bottom legend.
  colorLabels?: Partial<Record<Color, string>>
}
```

Board canvas state and the boards list are **persisted separately** in `localStorage`:

- `corkboard:boards` — ordered array of `{ id, title }` (the tab list)
- `corkboard:board:{id}` — full canvas state for each board

This way the tab list can be loaded instantly without deserializing every board’s nodes. **Workspace JSON export** must still read **every** `corkboard:board:{id}` (plus `corkboard:boards`) into one file — see [Export (v2) — JSON](#export-v2).

## Tech stack

| Piece        | Choice        | Why |
|-------------|---------------|-----|
| Framework   | Next.js (App Router) | Same stack as the author’s portfolio; good default for deployment and hiring signal. |
| Canvas      | [React Flow](https://reactflow.dev/) (`@xyflow/react`) | Purpose-built for node-based canvases; pan, zoom, drag, and edges are solved problems. |
| Styling     | Tailwind CSS  | Fast iteration and consistent UI. |
| Persistence | localStorage (web, v1–v2); workspace file on disk (v3 desktop) | Browser storage for the demo web app; **Tauri**-wrapped desktop uses a single save file per workspace with debounced auto-save. Optional cloud sync deferred to v4+ ([Desktop application and save files (v3)](#desktop-application-and-save-files-v3)). |

## Design decisions

### Note cards

- **Single free-form text body** — no separate title field. If a user wants a title card, they write one.
- **Double-click** enters edit mode; clicking outside or pressing `Escape` returns to view/drag mode.
- **Selecting a canvas note** (single click) drives the **top toolbar**: color swatches, font size (S/M/L/XL), B/I/U, “Cluster” (when a single canvas note is selected), delete, and defaults for **new** notes. There is no per-card floating toolbar in current UI.
- **Delete shortcut**: `Delete` when a note is selected and not in edit mode. `Backspace` is reserved for text editing.
- **Connection handles**: in **connection mode**, handles are visible on notes/clusters; otherwise they stay subtle / hover-oriented per product polish. Handles use each note’s color, not generic black dots.
- **Resize (v2)**: selected canvas notes expose a **bottom-right drag handle** that sets **width** and **height** (clamped min/max, persisted on the node). Overflow scrolls inside the card.
- **Resize to fit (v2)**: toolbar **Fit** sets **height** to the note body at the **current width** (grow or shrink; floor = default height). **Empty** body resets to default width and height. Applies to selected canvas notes (bulk), selected clusters (**top inner note** only), and the selected panel note. One undo step. See [Default note sizing mode (open)](#default-note-sizing-mode-open) for a future global auto-grow preference.

### Clusters

- **Creating a cluster**:
  - From the toolbar when a **single canvas note** is selected — promotes that note into a cluster at the same position.
  - Via **“Add cluster”** in the top toolbar — inserts a cluster with one blank note (same spirit as “Add note”).
- **Collapsed visual**: stack of cards at organic, slightly randomised angles:
  - 1 note → single card
  - 2 notes → 2 cards stacked
  - 3+ notes → 3 cards stacked (capped visually at 3)
- **Front card content**: the first note’s text verbatim (including its **formatting**). Users who want a cluster label make the first note a short title card.
- **Front card size**: the collapsed cluster’s width and preview body height follow the **first note in member order** (the same note as the front card). Each inner note may store its own optional `width` / `height`; reordering in the panel updates the canvas cluster to match the new top note’s dimensions.
- **Resize (v2)**: selected clusters expose the same **bottom-right resize handle** as notes. Dragging resizes **only the top inner note** (not every note in the cluster). Other inner notes keep their stored sizes for when they move to the front. Toolbar **Fit** uses the same top-note rule.
- **Expanding**: expand control on the cluster node opens the **side panel**; the cluster node stays on the canvas.
- **Side panel**:
  - Scrollable list of notes as editable cards.
  - Selecting a note in the panel highlights it; formatting for that note uses the **top toolbar** (same controls as canvas notes).
  - Cluster-level actions live in the **panel** (delete cluster, un-cluster, add note, etc.).
  - **Panel vs canvas size (open):** inner notes **store** `width` / `height`, but panel rows do **not** render at those dimensions today — only the collapsed canvas cluster does (for whichever note is currently on top). Reordering can change canvas size while panel cards stay full-width; behavior is intentional for v2 but worth revisiting before a cluster-panel layout pass. See [ROADMAP.md — Open questions](./ROADMAP.md#open-questions-defer--revisit-before-big-ui-changes).
- **Cluster-level actions**:
  - **Delete cluster** — removes the cluster and all contained notes.
  - **Un-cluster** — removes the cluster and places notes back on the canvas near the old position, spread slightly.
- **Empty cluster**: if the last note is removed, the cluster node is removed.
- **Closing**: collapse/close control on the panel header.
- **Removing a note from a cluster**: drag from the panel onto the canvas (grip on each row); undoable.

### Color system

- **Eight theme-aware note colors** — each key has a **light-mode** surface (brighter bg, dark body text) and a **dark-mode** surface (deeper bg, light body text), driven by `prefers-color-scheme` / Tailwind `dark:`. Handles and selection rings use a stronger **label** tint per color (see `src/lib/noteColors.ts`).
- **Semantic use** (e.g. characters vs scenes vs themes) makes the board scannable at a glance.
- Notes inside a cluster can be mixed colors; the panel shows each card’s own color.

#### Default note sizing mode (open)

v2 defaults to **fixed** cards: implicit default size, scroll when content overflows, manual resize or **Fit** to change dimensions. Some users prefer **auto-grow** (height follows content as they type, min = default). Deferred to **app preferences (v3+)**:

- Global default for **new** notes: fixed vs auto-grow.
- Per-note override after **manual resize** (fixed until changed again).
- Optional bulk “apply mode to board” is a separate product decision.

See [ROADMAP.md — Open questions](./ROADMAP.md#open-questions-defer--revisit-before-big-ui-changes).

#### Light and dark mode

**Note card colors — theme-adaptive**

- Card background, border, body text, handles, and selection ring all switch with system light/dark so notes stay legible on the cork surface in both themes.

**Chrome (board + UI) — theme-adaptive**

- Canvas background, toolbar, panel backgrounds, and chrome buttons follow the theme.

**Legacy boards:** persisted `colorKey` / `colorLabels` from the old six-color set (`amber`, `teal`, `violet`, `lime`, …) are remapped on load (see `normalizeNoteColorKey` in `noteColors.ts`).

**Future palette expansions**

- **v3**: **user-defined colors and themes** — custom hex per note, custom board backgrounds, full palette control.

#### Color labels / legend (v2)

Each color can have a **user-defined label per board** (persisted as `colorLabels` on the saved board JSON alongside `nodes` / `edges` / `viewport`).

**Implemented UI** (`ColorLegend` above board tabs):

- Chips only for colors that have a **non-empty** label; each chip shows swatch + name. **Click** the chip to **toggle the color filter** (same chip again clears). **Right-click** or **long-press** (~0.5s) opens **rename** (Save / Cancel / **Remove label**).
- **+ Category** when any of the eight colors is still unlabeled: choose color, then enter name (Save disabled until non-empty).
- Label edits participate in **undo/redo** with the rest of the board; **Clear board** wipes labels too.

- **Filter by color:** **click** a category chip to filter (whole chip is the control). **Right-click** or **long-press** the chip to rename. Matching notes stay full strength; others dim. **Clusters** count as matching if **any** inner note has that color; if the cluster has **no** notes yet, its canvas **color** (cluster tint) is used. **Edges** dim unless **both** endpoints match. An open cluster **panel** dims rows that don’t match. Clear with **Escape**, **Clear filter** at the **end of the legend row** (after **+ Category** when it is shown), or **click the same chip again**. **Removing that color’s category label** (rename popover: empty save or **Remove label**) **clears the filter** if it was that color. **Search (v2):** while the floating search bar is open, an active color filter is **suspended** (legend chip appears deactivated); closing search **restores** the prior filter — see [Search (v2)](#search-v2).

##### Discussion (not committed)

- **List view:** optionally combine filtering with a side list of every canvas node and cluster-internal note in the active color—useful on very large boards. Uncertain product fit; not implemented.

### Connections (edges)

- **Optional and low-attention** — not the primary focus.
- **Source and target** can be notes or clusters (any combination).
- **Connection mode** — toolbar toggle. While active:
  - Handles visible for drawing between nodes.
  - Drag from handle to handle to create an edge.
  - Toolbar shows an obvious active state.
  - Toggle off or press `Escape` to exit.
  - Works on touch without relying on hover.
- **Direction**: new edges start `direction: 'none'`. **Right-click** an edge for a menu: none → forward → reverse → both → none.
- **Labels**: select an edge to edit its label inline (per implementation).
- **Deleting an edge**: `Backspace` / `Delete` when selected, or from the edge context menu.

### Drag-to-pin

- **Drag a loose note onto a cluster** → cluster highlights → drop appends the note to the **end** of the cluster’s list and removes it from the canvas.
- **Drag a loose note onto another loose note** → target highlights → drop creates a **new cluster** at the target with both notes (target first, dragged second); both leave the canvas as standalone nodes.
- The dragged note’s **center** must be inside the target bounds.
- **Undo** uses the global undo/redo stack.

### Persistence

- **Debounced auto-save** (~500 ms) on changes; viewport changes also persist when pan/zoom settles (`onMoveEnd`).
- Board list and per-board canvas state use separate keys (see [Data model](#data-model)).
- **First load** with no data: create **“Board 1”**.
- **Clear board** (toolbar): confirm, then wipe nodes, edges, and viewport for the **current** tab only — not the tab itself.

**Web build (through v3+):** continues to use `localStorage` as today. Copy in the product should frame this honestly (e.g. data lives in the browser; export regularly for backup).

**Desktop (v3+):** same debounce idea, writing to a **workspace save file** (see [Desktop application and save files (v3)](#desktop-application-and-save-files-v3)).

### Multiple boards

Together, the open tabs are one **workspace** (see [Workspaces vs boards](#workspaces-vs-boards)).

- **Tabs** along the bottom; max **8** boards; “+” hidden at the limit.
- **Rename**: double-click tab title.
- **Reorder**: drag tabs.
- **Delete tab**: confirm; if that would leave zero boards, create a fresh **“Board 1”**.
- **Clear board** is a toolbar action on the **active** board, not on the tab row.

### Nested clusters (planned) vs nested corkboards (v3+)

**v1:** Clusters hold a flat list of notes only — no clusters inside clusters.

**Planned (target v2 unless reprioritized): one level of cluster nesting**

- **Depth rule:** At most **one** level. A **root** cluster may contain **notes** and **child clusters**; a **child cluster must not** contain another cluster (only notes). Deeper trees belong under **nested corkboards / sub-boards (v3+)**, not arbitrary cluster recursion.
- **Canvas — cluster onto cluster:** The **target** cluster is always the **parent** that stays on the canvas. On drop, show a **dialog**: **Flatten** (append every note from the dragged cluster to the **end** of the target as loose notes inside the target, then remove the dragged cluster node) **| Nest** (keep the dragged item as a **single child cluster** inside the target) **| Cancel** (abort; single **undo** step restores prior state). Edge rewiring and empty-cluster rules TBD in implementation.
- **Panel:** Child clusters appear as an **indented sub-list** (folder-style hierarchy in the UI). Optional later: **in-panel DnD** like a file tree — e.g. dropping directly **under** a nested-cluster row assigns into that child cluster; **reject** drops that would exceed one level.
- **“Make cluster”** in the panel: enable for a selected note only when the result is a **valid** child cluster (respect depth cap — e.g. not for a note that already sits inside a child cluster).

**Nested corkboards (v3+):** A cluster or board region acts as a **sub-board** — different scope and data model than “one extra level of cluster.” See [ROADMAP.md](./ROADMAP.md) v3.

### Search (v2)

`Cmd/Ctrl+F` (or equivalent) opens a **floating search bar** scoped to the **active board only**. Search is **full-text** across all **note bodies** — canvas notes and cluster-internal notes. **Cross-board search** is out of scope for v2.

#### Entry / exit

| Trigger | Effect |
|--------|--------|
| `Cmd/Ctrl+F` | Opens the search bar; focuses the input |
| `Escape` or ✕ | Closes the bar; restores full canvas state (match dimming / highlights, color filter) |
| Board tab switch | Closes the bar; clears all search state |

#### Query behavior

- Runs on every keystroke, **debounced ~150 ms**.
- **Minimum 1 character** before match state applies; empty input clears all match state.
- **Case-insensitive**.
- **Scope:** note **body** text only (canvas + cluster-internal).

#### Match state

| Element | Matching | Non-matching |
|--------|----------|----------------|
| Canvas notes | Full opacity + subtle **highlight ring** (tinted to the **card’s color**, not a generic yellow) | **Dimmed** |
| Cluster nodes | Full opacity + highlight ring if **≥ 1** internal note matches | **Dimmed** |
| Edges | **Unaffected** | — |

- **Dimming:** non-matches should read like the **category filter** “non-selected” treatment (same ballpark visually); no fixed opacity percentage in the spec.

- **Match count** in the bar: **“N matches”**, where **N** = number of matching **notes** (canvas + cluster-internal **counted individually**). One note whose body matches the query in multiple places still counts as **1** match. Two notes in the same cluster that both match = **2** matches.
- **Zero matches:** show **“No matches”**; **do not** dim the canvas.

#### Cycling

- **Forward:** `Enter`, `↓`, or **next** control in the bar.
- **Backward:** `Shift+Enter`, `↑`, or **previous** control in the bar.
- Counter: **“2 / 4 matches”** (current index / total). **Wraps** (last → first, first → last).

**Active match**

- Stronger than passive matches (e.g. stronger ring, slight scale or shadow) so the **current** hit is obvious.
- **Pan:** smoothly center the active match in the viewport. If it is **already fully visible**, **do not** pan.
- **Zoom:** if the active match is in view but **too small to read** at the current zoom, **zoom in** to a readable level **before** panning. **Do not** zoom out solely because the match is off-canvas.

**Cluster-internal matches**

- Each matching cluster-internal note is its own **cycle stop** and counts toward **N**.
- When the cycle lands on a cluster-internal match:
  - Open the **cluster panel** if it is not already open.
  - **Select / highlight** that note in the panel.
  - **Pan** the canvas to the **cluster node**.
- **Passive** matches inside a cluster (not the active stop): the cluster node stays at full opacity with passive match styling; the panel **does not** auto-open.
- Two notes in the **same** cluster that both match → **two** stops; the panel stays open when moving between them.

#### Interaction with color filter

- Opening search **suspends** any active color filter for the **search session**.
- The **category legend** reflects this: the active filter chip appears **deactivated / greyed** while search is open.
- Closing search (`Escape`, ✕, or board switch) **restores** the previously active color filter if one was set.

#### UI placement

- Bar floats **top-center**, **below** the main toolbar and **above** the canvas.
- Contents: text input, match counter (**“2 / 4 matches”** or **“No matches”**), prev/next controls, ✕ close.
- **Non-modal** — user can still pan and interact with the canvas while search is open.

### Export (v2)

Local-only; **no backend**.

#### PNG

- Rasterize the canvas (`html-to-image` or equivalent).
- Two modes: **current view** (viewport as-is) and **fit all** (zoom to fit every node, then capture). **Fit all** is the primary shareable “whole board” artifact.
- Default filename: **board title + timestamp** (per mode as needed).

#### JSON export / import

- **Scope:** the **entire current workspace** — all boards in the tab list, not only the active board — so the file is a complete project snapshot.
- **Web / localStorage:** Board list and per-board bodies are stored **separately** (`corkboard:boards` vs `corkboard:board:{id}`) so the UI can load the tab strip without deserializing every board ([Data model](#data-model)). The JSON exporter **must** deliberately **assemble** the snapshot from **all** of those keys (ordered tab list + each board’s full payload), not from the active board’s in-memory React Flow state alone. Skipping this would silently drop boards the user is not currently viewing.
- **Schema (versioned from day one):** `{ version, exportedAt, boards: BoardState[] }` where each entry is the full persisted state for one board (nodes, edges, viewport, `colorLabels`, titles / ids as in app storage). Forward-compatible import depends on bumping `version` when the shape changes.
- **Import:** file picker or drop onto the app.
- **Conflict behavior (v2):** **replace workspace** — no merge. Warn clearly before overwrite. This is the intentional primitive for **manual project switching**: export → fresh session → import.

#### Out of scope for v2

- No PDF.
- No shareable link (that implies hosted infrastructure; see v4+ if ever added).

### Desktop application and save files (v3)

Big Corkboard’s **primary target platform from v3 onward** is a **desktop application**. The web build at **bigcorkboard.com** remains a **demo**, acquisition surface, and **fallback** — not the main experience.

#### Rationale

- Infinite canvas + keyboard-heavy workflow fits **focused desktop sessions** and a **pointer** better than a casual browser tab.
- **Offline-first** is required: the tool must work with no network.
- **“Your data is yours”** — a workspace as a file on disk is the clearest expression of ownership.
- Desktop packaging avoids **browser storage fragility** (`localStorage` is one “clear site data” away from loss).

#### Implementation path

- **Tauri** is the preferred wrapper (Rust-backed, smaller binary than Electron, reuse of the existing Next.js / React UI).
- **Electron** is an acceptable fallback if Tauri + Next integration is too painful.
- **Capacitor / phone** — not a v3 driver; see [Mobile](#mobile).

#### Save file model

- One **workspace** ↔ one save file (e.g. `.corkboard`, JSON inside).
- Shell actions: **New workspace**, **Open** (file picker), **Save**, **Save as**, plus a **recent workspaces** list on launch.
- **Auto-save** on change (debounced), same spirit as today’s `localStorage` debounce — target is the filesystem instead.
- The **v2 JSON export document** *is* the save-file format — **no separate ad-hoc schema** for disk.

#### Web build (v3+)

- Still **`localStorage`** + the same in-app UX as today.
- **JSON export/import** remains the portability and backup escape hatch.
- **No cloud sync** on the web build in v3; messaging should encourage regular export for backup.

### Optional personal cloud sync (v4+)

Sync is **explicitly deferred** past the v3 desktop release. When built, it is **personal sync across the user’s own devices**, not collaboration.

#### Rationale

- Desktop save files already satisfy offline use and data ownership.
- Auth + storage + conflict policy is substantial scope and should not block shipping the desktop app.
- **Collaboration** (shared workspaces, real-time co-editing) is a **separate, larger track** — not bundled with solo sync.

#### When implemented (sketch)

- **Model:** **last-write-wins per workspace**, with per-device timestamps — appropriate for solo use.
- **Backend:** **Supabase** (auth + storage) unless superseded by a later decision.
- **Opt-in:** full offline use without an account; sync is an add-on layer.
- **Collaboration:** v4+ as its own feature set, not part of the first sync milestone.

### Mobile

- **Phone:** not a target. The interaction model (infinite canvas, drag, keyboard shortcuts) does not fit small touch screens.
- **Tablet (e.g. iPad):** desirable long-term; **Capacitor** (or similar) is a likely path, **after** v3 desktop ships.
- **Product constraint:** no mobile-specific architecture requirements should compromise the v3 desktop save-file design.

### Image nodes (v3)

Images are **first-class canvas objects** — an `imageNode` type with the same drag/connect/pin behavior as notes where applicable.

- **Adding**: file drop on canvas or paste when canvas is focused and no note is editing.
- **Resizing**: horizontal resize control (same idea as notes).
- **Selection UI**: color/tint, caption, delete — no rich body text.
- **Storage**: blobs don’t live in `localStorage`; **IndexedDB** in the web build; in the **v3 desktop** app, bundle or reference blobs in a way consistent with the workspace save file; **Supabase Storage** (or equivalent) only if **v4+** optional sync is enabled.

Data sketch:

```ts
type ImageNode = {
  id: string
  type: 'image'
  colorKey: Color       // border/frame tint for category
  imageRef: string      // UUID → IndexedDB (web) | embedded in workspace file (desktop) | remote URL if v4+ sync
  caption?: string
  position: { x: number; y: number }
  width: number         // user-resizable
}
```

Clusters could later hold `NoteCard | ImageNode` (model evolution: e.g. `items` instead of `notes`).

---

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The home route renders `Board` from `src/components/Board.tsx`; UI components live under `src/components/`.

Bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).
