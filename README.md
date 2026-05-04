# Big Corkboard

A digital cork board for planning writing projects: an infinite canvas where you place standalone notes and expandable clusters, drag them freely, and (later) connect them. The product goal is quick visual scanning and spatial thinking—not a rigid file hierarchy.

## Goals

- **Capture ideas where they land.** Notes and clusters coexist anywhere on the board; nothing forces a folder tree mindset.
- **Feel like a real corkboard.** Stacked cards, color at a glance, optional connections that stay unobtrusive until you need them.
- **Ship a solid v1 fast** by leaning on React Flow for pan/zoom/drag/connect and focusing energy on note UX, clusters, and persistence.

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

This way the tab list can be loaded instantly without deserializing every board's nodes.

## Tech stack

| Piece        | Choice        | Why |
|-------------|---------------|-----|
| Framework   | Next.js (App Router) | Same stack as the author's portfolio; good default for deployment and hiring signal. |
| Canvas      | [React Flow](https://reactflow.dev/) (`@xyflow/react`) | Purpose-built for node-based canvases; pan, zoom, drag, and edges are solved problems. |
| Styling     | Tailwind CSS  | Fast iteration and consistent UI. |
| Persistence | localStorage (v1) | Simple reload survival; migrate to sync when ready. |

## Design decisions

### Note cards

- **Single free-form text body** — no separate title field. If a user wants a title card, they write one.
- **Double-click** enters edit mode; clicking outside or pressing `Escape` returns to view/drag mode.
- **Selecting a note** (single click) opens a **floating selection popup** (`NodeToolbar`) anchored above the card. The popup contains:
  - Color swatches (recolors the note in place)
  - Font size buttons: S / M / L / XL (whole-note)
  - Formatting toggles: B / I / U (whole-note — no rich text ranges)
  - A **"Create cluster"** button (promotes the note into a new cluster at the same position)
  - A **delete button**
- **Delete shortcut**: `Delete` key when a note is selected and not in edit mode. `Backspace` is reserved for text editing.
- **Connection handles**: visible only on hover; styled as a subtle, slightly darker shade of the note's own color rather than generic black dots.

### Clusters

- **Creating a cluster**:
  - Via note selection popup → "Create cluster" (converts one loose note into a cluster containing it).
  - Via **"Add cluster"** button in the top toolbar (creates a cluster with one blank note, same as "Add note").
- **Collapsed visual**: stack of cards at organic, slightly-randomised angles:
  - 1 note → single card
  - 2 notes → 2 cards stacked
  - 3+ notes → 3 cards stacked (capped visually at 3)
- **Front card content**: the first note's text verbatim. Users who want a cluster label just make the first note a short title card.
- **Expanding**: a dedicated expand button on the cluster node opens the side panel. The cluster node stays visible on the canvas.
- **Side panel**:
  - Scrollable list of all notes, each rendered as an editable card.
  - Selecting a note inside the panel highlights it and activates the **note formatting toolbar at the top of the panel** (same color/size/B-I-U/delete controls as the canvas popup).
  - **No `NodeToolbar` on the cluster canvas node itself** — cluster-level actions live in the side panel.
- **Cluster-level actions** (in the side panel header or footer):
  - **Delete cluster** — deletes the cluster and all its notes. No scatter.
  - **Un-cluster** — removes the cluster node and places all its notes back on the canvas as loose notes at approximately the cluster's position, spread slightly so they don't stack exactly.
- **Empty cluster**: if the last note is deleted from the panel, the cluster node auto-deletes.
- **Collapsing**: close/collapse button on the panel header.
- **Removing a note from a cluster**: drag it from the side panel back onto the canvas *(deferred to chunk 8)*.

### Color system

- **Soft pastel palette** — light backgrounds with legible `text-stone-800` text. Six colors: amber, sky, teal, rose, violet, lime.
- **Semantic use** (e.g. characters vs scenes vs themes) makes the board scannable at a glance.
- Notes inside a cluster can be mixed colors; the panel shows each card's own color.

#### Light and dark mode

The app supports light and dark mode, but the two areas are handled independently:

**Note card colors — theme-agnostic (v1)**
- Note card backgrounds, borders, and text are **always the pastel palette** regardless of system theme. The cards are designed around these specific colors.
- Placeholder text inside notes is **always dark** (`text-stone-500` or similar) — not a `dark:` variant — because the note surface is always light. Using a `dark:` text variant here would make placeholder text illegible on the pastel background when the OS is in dark mode.

**Chrome (board + UI) — theme-adaptive (v1)**
- The **canvas background**, **toolbar**, **panel backgrounds**, and **action buttons** all respond to light/dark mode.
- Light mode: white/near-white canvas, light toolbar, dark button text.
- Dark mode: dark canvas, dark toolbar, light button text.

**Future palette expansions**
- **v2**: a second set of **neon/vivid note colors** designed to pop on a dark canvas. Users could switch between the pastel set and the neon set per board.
- **v3**: **user-defined colors and themes** — custom hex values per note, custom board backgrounds, full palette control.

#### Color labels / legend (v2)

Each color can have a **user-defined label per board** (stored in `Board.colorLabels`). The data model field is included from v1 so no migration is needed when the UI ships.

**Planned UI:**
- A **legend strip along the bottom** of the canvas (above the board tabs) shows a color swatch + label for each color that has been assigned a name. Unlabeled colors don't appear.
- A subtle **"+ Assign category"** button at the end of the strip opens an inline editor for any of the six colors.
- Clicking an existing legend chip opens a small popover to rename or clear that color's label.

**v3 extension:** a **"Filter by category"** view that shows all notes (canvas + inside clusters) belonging to a chosen color — useful once a board is large and dense.

### Connections (edges)

- **Optional and low-attention** — connections are available but not the primary focus.
- **Source and target** can be notes or clusters (any combination).
- **Connection mode** — a dedicated toggle button in the top toolbar switches the board into connection mode. While active:
  - All node handles become visible (styled as small dots in each note's own color, on all 4 sides and 4 corners).
  - The user draws an edge by dragging from one handle to another.
  - The toolbar button shows a clear "active" state so it's obvious the mode is on.
  - Tapping/clicking the button again (or pressing `Escape`) exits connection mode and hides handles.
  - This approach works identically on touch and desktop — no hover required.
- **Direction**: new edges start with `direction: 'none'` (no arrow). A **right-click context menu** on any edge toggles: none → forward → reverse → both → none.
- **Labels**: click an edge to edit its label inline.
- **Deleting an edge**: `Backspace` or `Delete` when selected, or via the right-click context menu.

### Drag-to-pin

- **Drag a loose note over a cluster** → cluster highlights → release → note appended to the **end** of the cluster's notes list and removed from the canvas.
- **Drag a loose note over another standalone note** → target note highlights → release → a new cluster is created at the target note's position containing both notes (target note first, dragged note appended). Both source notes are removed from the canvas.
- The dragged note's center must be inside the target's bounds to trigger the drop (not just overlapping the edge).
- **Undo** is handled by the full undo/redo history (chunk 6), not a special-case handler.

### Persistence

- **Debounced auto-save** (~500 ms) on every change — no manual save step.
- Board list (`corkboard:boards`) and canvas state (`corkboard:board:{id}`) are stored separately.
- **First load** with no data: one blank board named "Board 1" is created automatically.
- **Clear board** (top toolbar): confirmation dialog → wipes the current board's nodes, edges, and viewport. Does not delete the tab.

### Multiple boards

- **Tabs along the bottom**, spreadsheet-style. Max **8 boards** in v1; "+" button hidden at the limit.
- Tabs can be **renamed** (double-click the tab label) and **reordered by drag**.
- **Deleting a board tab**: if deleting would leave zero boards, a fresh blank "Board 1" is created automatically.
- "Clear board" lives in the **top toolbar**, not on the tab itself — it operates on the currently active board.

### Nested corkboards

- **Not in v1.** Clusters are modelled as containers (array of note objects). The jump to "a cluster contains nodes / sub-boards" is a data-shape extension, not a rewrite.

### Search & filtering (v2)

- `Cmd/Ctrl+F` opens a search bar that slides down from / overlays the top toolbar.
- **Scope**: full-text match against all note bodies on the current board — canvas notes and notes inside clusters.
- **Highlight mode**: matching notes glow; non-matching notes and clusters dim in place. The canvas doesn't auto-scroll — the user pans to highlighted results themselves.
- **Filter by color**: clicking a color swatch in the color-label legend (v2) dims everything that doesn't match that color. The filter stays active until `Escape` is pressed or the swatch is clicked again.
- Cross-board search (searching all boards at once) is out of scope for v2 — scope is always the active board.

### Export (v2)

- **Export to PNG**: rasterizes the React Flow canvas using `html-to-image` (or similar). The user can choose "current view" (whatever is visible at the current zoom) or "fit all" (zoom-to-fit the whole board, then capture). The downloaded file name defaults to the board title.
- **Export to JSON**: downloads the raw board state (`nodes`, `edges`, `viewport`) as a `.json` file — useful as a manual backup and as an import format for restoring a board.
- No PDF or shareable link in v2; shareable links require the cloud sync backend introduced in v3.

### Image nodes (v3)

Images are **first-class canvas objects** — a new `imageNode` node type that behaves identically to a note card on the canvas:

- Drag freely, connect with edges, drag-to-pin into clusters.
- **Adding**: drag an image file onto the canvas, or paste from the clipboard while the canvas is focused and no note is in edit mode.
- **Resizing**: a horizontal resize handle (same mechanic as note cards).
- **`NodeToolbar` on selection**: color swatch (applies a tinted border/frame for category), optional caption field, delete button. No text formatting controls (there's no text body).
- **Storage**: image blobs are too large for `localStorage`. Blobs are stored in **IndexedDB** keyed by a UUID; the board's serialised state only stores the UUID reference. When cloud sync is active, blobs are uploaded to **Supabase Storage** and the reference becomes a Storage URL.

Data model addition:

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

Clusters can contain image nodes alongside notes. The data model change is `ClusterNode.items: (NoteCard | ImageNode)[]` replacing `ClusterNode.notes`.

### Cloud sync (v3)

Single-user sync across devices via **Supabase**.

- **Auth**: email magic-link + Google OAuth. No account required — the app is fully functional in local-only mode indefinitely.
- **Data flow**: `localStorage` remains the offline source of truth. On sign-in, boards are pushed to Supabase and kept in sync. Conflict strategy for v1: last-write-wins per board (simple for a solo-user scenario).
- **Supabase schema** (mirrors the existing data shape closely):
  - `boards(id, user_id, title, viewport, color_labels, updated_at)`
  - `nodes(id, board_id, type, position, data)` — `data` stored as JSONB
  - `edges(id, board_id, source, target, data)`
  - `storage/images/{user_id}/{image_id}` — image blobs (Supabase Storage)
- **Real-time co-editing and shareable links**: out of scope for v3 — these are v4 additions.

### Mobile (v3, alongside cloud sync)

The web app is wrapped with **[Capacitor](https://capacitorjs.com/)** for iOS and Android. The same Next.js codebase is exported as a static build and embedded in the native shell.

Key touch tuning required:

- **Keyboard avoidance**: when a note enters edit mode the canvas must scroll up so the focused `textarea` isn't hidden behind the soft keyboard. Use Capacitor's `KeyboardPlugin` to read the keyboard height and apply a matching bottom offset.
- **Safe areas**: the top toolbar and bottom tab bar need `env(safe-area-inset-*)` padding for notch and home-indicator devices.
- **Haptic feedback**: light tap feedback on drag-to-pin drops and cluster creation via Capacitor's `HapticsPlugin`.
- **Pinch-to-zoom**: React Flow handles two-finger pinch natively; sensitivity limits (`minZoom` / `maxZoom`) may need tuning for touch.
- **Connection mode**: tap-based handle interaction already works because handles are only shown in connection mode — no hover state required.
- **Offline / sync**: Capacitor's `Network` plugin gates sync calls so they only fire when the device is online.

## Roadmap (high level)

1. **Canvas + note nodes** ✓ — full-screen canvas; notecards with color, drag, double-click-to-edit.
2. **Selection popup** ✓ — `NodeToolbar` with color, font size, B/I/U, create-cluster, delete.
3. **Cluster nodes** ✓ — stacked visual; expand button; side panel with editable notes; cluster-level delete and un-cluster.
4. **Drag-to-pin** ✓ — center-of-note detection; cluster/note highlights; note-on-cluster appends; note-on-note creates new cluster.
5. **Connections** ✓ — labeled edges; handles visible in connection mode only; direction toggle via right-click; note ↔ cluster ↔ cluster connections.
6. **Undo / redo** ✓ — full history stack (capped ~50); `Cmd+Z` / `Cmd+Shift+Z` keyboard shortcuts; undo/redo buttons in the top toolbar (disabled when unavailable); snapshots on committed actions (drag stop, create, delete, pin, edge ops, text blur, format change); no per-keystroke snapshots.
7. **Persistence** ✓ — debounced auto-save (~500 ms) on every node/edge change, plus immediate save on viewport change (`onMoveEnd`). Separate `corkboard:boards` and `corkboard:board:{id}` localStorage keys. First load with no saved data auto-creates "Board 1". `Board` loaded via `next/dynamic` with `ssr: false` so localStorage is always available. **Clear board** button in the top toolbar: `window.confirm` dialog, then wipes nodes, edges, and resets viewport (via inner `ViewportResetter` component); clears undo/redo history.
8. **Multiple boards** ✓ — spreadsheet-style tab bar at the bottom; max 8 boards; "+" button hidden at the limit. Tabs: click to switch (active board saved immediately on unmount), double-click to rename inline, drag to reorder, × to delete (with confirm). Deleting the last board auto-creates "Board 1". Last-active board persisted to `corkboard:activeBoard`.
9. **Drag-out from cluster panel** ✓ — each panel note has a 6-dot grip handle (visible on hover) that initiates an HTML5 drag carrying the note's data via `dataTransfer`. The canvas accepts the drop (`onDragOver` / `onDrop` on the wrapper div), converts the screen drop position to canvas coordinates via `screenToFlowPosition` (captured inside the ReactFlow provider by a `SFPCapture` helper component), and places the note as a loose `noteCard` at that position. The note is removed from the cluster; if the cluster becomes empty it is deleted automatically. The action is fully undoable.
10. **Look and feel improvements** — tracked as individual GitHub issues; goal is to close all issues before calling v1 complete.

Post-v1 backlog:

**v2** — polish and power features, no backend required:
- Color label legend + filter by color (legend strip, "Assign category" editor)
- Neon/vivid note palette designed for dark canvases
- Search & filter on the active board (`Cmd+F`, highlight mode, filter by color)
- Export to PNG and JSON
- Drag-out from cluster panel (deferred from v1)

**v3** — backend and native:
- Image nodes (IndexedDB for local blob storage, Supabase Storage for cloud)
- Cloud sync — Supabase auth (magic-link + Google), single-user cross-device
- User-defined colors and themes (custom hex per note, custom board backgrounds)
- Capacitor mobile packaging + touch polish (keyboard avoidance, haptics, safe areas)
- Nested corkboards / cluster-as-sub-board

**v4** — collaboration:
- Shareable read-only links
- Real-time co-editing (Supabase Realtime + CRDT conflict resolution)
- Full-text search across all boards

### Mobile apps (v3)

The web app is wrapped with **[Capacitor](https://capacitorjs.com/)** for iOS and Android as part of the v3 milestone. See the full spec above under [Mobile](#mobile-v3-alongside-cloud-sync).

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The home route renders `Board` from `src/components/Board.tsx`; all UI components live under `src/components/`.

---

Bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).
