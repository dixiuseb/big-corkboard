# Big Corkboard

A digital cork board for planning writing projects: an infinite canvas where you place standalone notes and expandable clusters, drag them freely, and connect ideas when you want. The point is quick visual scanning and spatial thinking—not a rigid folder tree.

**Try it:** [bigcorkboard.com](https://bigcorkboard.com) — runs in your browser. **v1** keeps your boards on **this device only** (see [Where your data stays](#where-your-data-stays)).

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

- **Add note** from the top toolbar. New notes use the color and formatting shown in the toolbar until you change them.
- **Move** a note by dragging the card.
- **Edit:** double-click the note, type, then click outside or press **Escape** to leave edit mode.
- **Select** a note (one click) to change **color**, **size** (S / M / L / XL), and **bold / italic / underline** in the toolbar. Formatting applies to the **whole note**—there’s no rich-text selection inside a note.
- **Delete** the selected note from the toolbar, or press **Delete** when a note is selected and you’re not typing in it.

### Categories (legend)

Above the board tabs, **Categories** lists **named colors** for this board only (e.g. “Characters” on iris). Use **+ Category** to pick an unused color and give it a name. **Click** a category chip to **filter** the board by that color (click again to clear); **right-click** or **long-press** a chip to **rename** or remove its label. **Clear filter** appears at the **end** of the legend row while a filter is on. These names are saved with the board; **Undo** applies to label changes too.

### Clusters

A cluster is a **stack of cards** on the canvas that opens into a **side panel** of notes.

- **Add cluster** (toolbar): creates a new cluster with one empty note inside.
- **Turn one canvas note into a cluster:** select that note, then use the toolbar’s cluster action.
- **Open:** use the expand control on the stack. A **Cluster notes** panel opens on the right; the stack stays on the canvas.
- In the panel you can **add**, **edit**, **reorder**, or **delete** notes. Click a note to align the top toolbar with **that** note’s color and formatting.
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

### Where your data stays

v1 saves automatically to **local storage in your browser**. There is **no sign-in** and **no server copy**—your boards exist only on this device and profile. Clearing site data or using another browser means that copy of the boards is gone unless you’ve kept a separate backup (JSON/PNG export is planned for v2).

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
