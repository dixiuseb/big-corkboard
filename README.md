# Big Corkboard

A digital cork board for planning writing projects: an infinite canvas where you place standalone notes and expandable clusters, drag them freely, and connect ideas when you want. The point is quick visual scanning and spatial thinking—not a rigid folder tree.

**Try it:** [bigcorkboard.com](https://bigcorkboard.com) — runs in your browser. Boards stay on **this device only** (see [Where your data stays](#where-your-data-stays)). **v2** adds categories, search, export, nested clusters, resize, multi-select, and more; use **File → Export workspace…** to back up or move projects (`.corkboard` file).

---

## How to use

### Canvas

- **Pan** by dragging empty space on the dotted background.
- **Zoom** with trackpad/mouse wheel or pinch on a trackpad or touchscreen (behavior can vary slightly by browser).

### Boards (bottom tabs)

- Tabs switch between boards (**up to 8**). **+** adds another board when you’re under the limit.
- **Rename:** double-click a tab’s title.
- **Reorder:** drag tabs sideways.
- **Delete a board:** the small **×** on the tab (with confirmation). You always keep at least one board.
- The app remembers which board you had open last time.

### Notes

- **Add note** from the top toolbar — click to place at the center, or **drag** the button onto the canvas where you want it.
- **Move** a note by dragging the card.
- **Edit:** double-click the note, type, then click outside or press **Escape** to leave edit mode.
- **Select** a note (one click) to change **color**, **size** (S / M / L / XL), and **bold / italic / underline** in the toolbar. Formatting applies to the **whole note**—there’s no rich-text selection inside a note.
- **Resize** a selected note from the **bottom-right handle**, or use **Fit** in the toolbar to shrink or grow height to match the text at the current width.
- **Delete** the selected note from the toolbar, or press **Delete** when a note is selected and you’re not typing in it.
- **Multi-select:** hold **Shift** and click notes, or drag a selection box on the canvas; bulk color, format, delete, and **Fit** apply to the selection.

### Categories (legend)

Above the board tabs, **Categories** lists **named colors** for this board only (e.g. “Characters” on iris). Use **+ Category** to pick an unused color and give it a name. **Click** a category chip to **filter** the board by that color (click again to clear); **right-click** or **long-press** a chip to **rename** or remove its label. **Clear filter** appears at the **end** of the legend row while a filter is on. These names are saved with the board; **Undo** applies to label changes too.

### Search

Press **Cmd/Ctrl+F** to search note text on the **current board**. Use **Enter** / **Shift+Enter** (or the bar’s arrows) to jump between matches. **Escape** closes search.

### Clusters

A cluster is a **stack of cards** on the canvas that opens into a **side panel** of notes.

- **Add cluster** (toolbar): click or **drag** onto the canvas — creates a new cluster with one empty note inside.
- **Turn one canvas note into a cluster:** select that note, then use the toolbar’s cluster action.
- **Open:** use the expand control on the stack. A **Cluster notes** panel opens on the right; the stack stays on the canvas.
- **Double-click** a collapsed cluster to edit its **front** note inline (the top note in the stack).
- In the panel you can **add**, **edit**, **reorder**, or **delete** notes. Click a note to align the top toolbar with **that** note’s color and formatting.
- **Nested clusters (v2):** drag one cluster onto another to **nest** or **flatten**; the panel shows child clusters indented under their parent.
- **Pull a note out:** drag from the **grip** on a row onto the canvas—it becomes a normal note again. **Undo** reverses this if needed.
- **Close** the panel from its header when you’re done.
- **Delete cluster** or **un-cluster** (spill all notes onto the canvas) from the panel when you need those actions.

### Drag notes together (on the canvas)

- Drag a **loose note onto a cluster** (it highlights when you’re over it): the note **joins** that cluster.
- Drag a **loose note onto another loose note**: they become a **new cluster** holding both.

### Connections

- Turn **Connect** on in the toolbar. **Handles** appear on notes and clusters.
- **Drag from one handle to another** to draw a connection.
- Turn **Connect** off again or press **Escape** to leave connection mode.
- **Right-click a connection** to change arrow direction or delete it. You can also remove a selected connection with **Delete** / **Backspace** where supported.

### Undo & redo

Use the toolbar arrows (and your OS undo/redo shortcuts) to step back and forward through recent work—moves, text, formatting, **category labels**, clusters, connections, and drag-out from clusters.

### Clear this board

**Clear** in the toolbar wipes **all notes, connections, and category labels** on the **current** board after you confirm. It does **not** remove the tab itself.

### Export & backup (File menu)

- **Export PNG** — current view or **fit all** notes on the board.
- **Export workspace…** — saves **all boards** to a **`.corkboard`** file (JSON inside). Use this to back up or move a project to another browser or device.
- **Import workspace…** — replaces the current workspace with a `.corkboard` (or legacy `.json`) file. You’ll be asked to confirm before overwrite.

### Where your data stays

The app saves automatically to **local storage in your browser**. There is **no sign-in** and **no server copy**—your boards exist only on this device and browser profile. Clearing site data or switching browsers means that copy is gone unless you’ve exported a **`.corkboard`** backup.

**v3 (planned):** a **desktop app** will save the same workspace format as a file on disk (New / Open / Save). The web app will remain available with browser storage and export as a fallback.

---

## For contributors

Implementation details, data model, and forward-looking design live in **[SPEC.md](./SPEC.md)**. Release phases and checklists: **[ROADMAP.md](./ROADMAP.md)**.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for local development.

---

Bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).
