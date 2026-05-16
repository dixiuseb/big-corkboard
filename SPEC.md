# Big Corkboard — specification

This document is the **technical and product design spec** for contributors, agents, and anyone implementing features. **How to use the app** (end-user) lives in [README.md](./README.md). **What shipped and what’s next** lives in [ROADMAP.md](./ROADMAP.md).

---

## Goals

- **Capture ideas where they land.** Notes and clusters coexist anywhere on the board; nothing forces a folder tree mindset.
- **Feel like a real corkboard.** Stacked cards, color at a glance, optional connections that stay unobtrusive until you need them.
- **Ship in focused versions** — v1 leaned on React Flow for pan/zoom/drag/connect and prioritized note UX, clusters, and local persistence; v2 adds search, export, and category polish without a backend ([roadmap](./ROADMAP.md)).

## Mental model

One infinite canvas: **standalone notecards** and **expandable cluster-nodes** can live side by side. Connections between items are optional. State is persisted locally first; the data shape should allow **remote sync (e.g. Supabase)** as a later addition without a rewrite.

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

This way the tab list can be loaded instantly without deserializing every board’s nodes.

## Tech stack

| Piece        | Choice        | Why |
|-------------|---------------|-----|
| Framework   | Next.js (App Router) | Same stack as the author’s portfolio; good default for deployment and hiring signal. |
| Canvas      | [React Flow](https://reactflow.dev/) (`@xyflow/react`) | Purpose-built for node-based canvases; pan, zoom, drag, and edges are solved problems. |
| Styling     | Tailwind CSS  | Fast iteration and consistent UI. |
| Persistence | localStorage (v1) | Simple reload survival; migrate to sync when ready. |

## Design decisions

### Note cards

- **Single free-form text body** — no separate title field. If a user wants a title card, they write one.
- **Double-click** enters edit mode; clicking outside or pressing `Escape` returns to view/drag mode.
- **Selecting a canvas note** (single click) drives the **top toolbar**: color swatches, font size (S/M/L/XL), B/I/U, “Cluster” (when a single canvas note is selected), delete, and defaults for **new** notes. There is no per-card floating toolbar in current UI.
- **Delete shortcut**: `Delete` when a note is selected and not in edit mode. `Backspace` is reserved for text editing.
- **Connection handles**: in **connection mode**, handles are visible on notes/clusters; otherwise they stay subtle / hover-oriented per product polish. Handles use each note’s color, not generic black dots.

### Clusters

- **Creating a cluster**:
  - From the toolbar when a **single canvas note** is selected — promotes that note into a cluster at the same position.
  - Via **“Add cluster”** in the top toolbar — inserts a cluster with one blank note (same spirit as “Add note”).
- **Collapsed visual**: stack of cards at organic, slightly randomised angles:
  - 1 note → single card
  - 2 notes → 2 cards stacked
  - 3+ notes → 3 cards stacked (capped visually at 3)
- **Front card content**: the first note’s text verbatim. Users who want a cluster label make the first note a short title card.
- **Expanding**: expand control on the cluster node opens the **side panel**; the cluster node stays on the canvas.
- **Side panel**:
  - Scrollable list of notes as editable cards.
  - Selecting a note in the panel highlights it; formatting for that note uses the **top toolbar** (same controls as canvas notes).
  - Cluster-level actions live in the **panel** (delete cluster, un-cluster, add note, etc.).
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

- **Filter by color:** **click** a category chip to filter (whole chip is the control). **Right-click** or **long-press** the chip to rename. Matching notes stay full strength; others dim. **Clusters** count as matching if **any** inner note has that color; if the cluster has **no** notes yet, its canvas **color** (cluster tint) is used. **Edges** dim unless **both** endpoints match. An open cluster **panel** dims rows that don’t match. Clear with **Escape**, **Clear filter** at the **end of the legend row** (after **+ Category** when it is shown), or **click the same chip again**. **Removing that color’s category label** (rename popover: empty save or **Remove label**) **clears the filter** if it was that color.

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

### Multiple boards

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

### Search & filtering (v2)

- `Cmd/Ctrl+F` (or equivalent) opens search UI tied to the **active board** only.
- **Scope**: full text on all note bodies (canvas + inside clusters).
- **Highlight**: matches emphasized; non-matches dimmed; canvas does not auto-pan to hits.
- **Filter by color** (with legend): dim non-matching notes, clusters, edges, and panel rows; clear with `Escape`, **Clear filter** at the end of the legend row, or toggling the same chip again.
- Cross-board search is **out of scope** for v2.

### Export (v2)

- **PNG**: rasterize the canvas (`html-to-image` or similar); options for “current view” vs “fit all”; default filename from board title.
- **JSON**: download `nodes`, `edges`, `viewport` as backup / interchange.
- No PDF or shareable link in v2 (shareable links need cloud backend, v3+).

### Image nodes (v3)

Images are **first-class canvas objects** — an `imageNode` type with the same drag/connect/pin behavior as notes where applicable.

- **Adding**: file drop on canvas or paste when canvas is focused and no note is editing.
- **Resizing**: horizontal resize control (same idea as notes).
- **Selection UI**: color/tint, caption, delete — no rich body text.
- **Storage**: blobs don’t live in `localStorage`; **IndexedDB** keyed by UUID in local mode; with sync, **Supabase Storage** and URLs in JSON.

Data sketch:

```ts
type ImageNode = {
  id: string
  type: 'image'
  colorKey: Color       // border/frame tint for category
  imageRef: string      // UUID → IndexedDB (local) or Storage URL (cloud)
  caption?: string
  position: { x: number; y: number }
  width: number         // user-resizable
}
```

Clusters could later hold `NoteCard | ImageNode` (model evolution: e.g. `items` instead of `notes`).

### Cloud sync (v3)

Single-user sync via **Supabase**.

- **Auth**: magic link + Google OAuth. Local-only mode remains fully usable without an account.
- **Data flow**: `localStorage` stays the offline source of truth; on sign-in, boards sync up. **Conflict handling** for solo v3: last-write-wins per board (simplest).
- **Schema** (sketch): `boards`, `nodes` (JSONB `data`), `edges`, Storage for image blobs.
- **Realtime / share links**: v4, not v3.

### Mobile (v3, alongside cloud sync)

Wrap the web app with **[Capacitor](https://capacitorjs.com/)** for iOS and Android; static export of the Next app in a native shell.

Touch / native concerns:

- **Keyboard avoidance** — `KeyboardPlugin` + offset so `textarea` isn’t hidden.
- **Safe areas** — `env(safe-area-inset-*)` on toolbar and tab bar.
- **Haptics** — light feedback on drop / cluster create where appropriate.
- **Pinch zoom** — React Flow; tune `minZoom` / `maxZoom` for touch.
- **Connection mode** — tap-friendly because handles show in that mode.
- **Network** — gate sync when offline (`Network` plugin).

---

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The home route renders `Board` from `src/components/Board.tsx`; UI components live under `src/components/`.

Bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).
