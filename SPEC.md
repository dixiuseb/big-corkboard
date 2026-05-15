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
type Color = 'amber' | 'sky' | 'teal' | 'rose' | 'violet' | 'lime'

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
  // User-defined label per color (e.g. amber → "Characters", sky → "Scenes").
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

- **Soft pastel palette** — light backgrounds with legible `text-stone-800` text. Six colors: amber, sky, teal, rose, violet, lime.
- **Semantic use** (e.g. characters vs scenes vs themes) makes the board scannable at a glance.
- Notes inside a cluster can be mixed colors; the panel shows each card’s own color.

#### Light and dark mode

The app supports light and dark mode, but the two areas are handled independently:

**Note card colors — theme-agnostic (v1)**

- Note card backgrounds, borders, and text use the **pastel palette** regardless of system theme.
- Placeholder text inside notes stays **dark** (`text-stone-500` or similar) — not a `dark:` variant — because the note surface stays light; a `dark:` variant would be illegible in OS dark mode.

**Chrome (board + UI) — theme-adaptive (v1)**

- Canvas background, toolbar, panel backgrounds, and chrome buttons follow the theme.

**Future palette expansions**

- **v2**: a second set of **neon/vivid note colors** for dark canvases; optional switch (e.g. per board) TBD.
- **v3**: **user-defined colors and themes** — custom hex per note, custom board backgrounds, full palette control.

#### Color labels / legend (v2)

Each color can have a **user-defined label per board** (stored in `Board.colorLabels`). The field exists from v1 so the legend UI needs no migration.

**Planned UI:**

- A **legend strip** along the bottom of the canvas (above board tabs): swatch + label for each named color; unlabeled colors omitted.
- **“+ Assign category”** (or similar) opens an inline editor for any of the six colors.
- Clicking a chip opens rename/clear.

**v3 extension:** a **“Filter by category”** view listing all notes (canvas + inside clusters) for one color — for very large boards.

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

### Nested corkboards

- **Not in v1.** Clusters are in-memory arrays of notes. Evolving to “cluster as sub-board” is a data-shape extension, not a full rewrite of v1.

### Search & filtering (v2)

- `Cmd/Ctrl+F` (or equivalent) opens search UI tied to the **active board** only.
- **Scope**: full text on all note bodies (canvas + inside clusters).
- **Highlight**: matches emphasized; non-matches dimmed; canvas does not auto-pan to hits.
- **Filter by color** (with legend): dim non-matching items; clear with `Escape` or toggling the swatch.
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
