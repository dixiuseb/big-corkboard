<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->


# Big Corkboard — AI Agent Context

## Project overview
A digital corkboard for writing project planning. Infinite canvas with 
standalone notecards and expandable cluster nodes. See **SPEC.md** for 
data model and design decisions; **README.md** for end-user how-to; **ROADMAP.md** for shipped versions and upcoming work.

## Stack
- Next.js (App Router) + React + TypeScript
- React Flow (@xyflow/react) for the canvas
- Tailwind CSS for styling
- localStorage for persistence (web, v1–v2); `.corkboard` save files on disk (v3 desktop, Tauri)

## Critical conventions
- Use `BoardEdge` not `Connection` — avoids collision with React Flow's 
  own Connection type
- Formatting is **whole-note only** — no inline rich text ranges, no 
  contenteditable, just boolean flags on the NoteCard object
- Notes inside clusters are NOT canvas nodes — they live in 
  `ClusterNodeData.members[]` (`ClusterMember[]`) and are not registered with React Flow
- Handles appear on hover only, styled as a darker shade of the node's 
  own color — never default black React Flow handles

## Color palette (eight theme-aware note colors)

See `src/lib/noteColors.ts` for keys, hex values, and migration from the old six-color set. Handles use each note’s label tint — not generic black React Flow dots.

## Persistence keys
- `corkboard:boards` — ordered array of { id, title }
- `corkboard:board:{id}` — full canvas state per board

## Workspace save file
- Extension: **`.corkboard`** (UTF-8 JSON)
- Envelope: `{ version: 2, exportedAt, boards[] }` — see `src/lib/workspaceJson.ts`
- Import accepts **version 1 or 2** (legacy early v2 `.json` backups)

## Current roadmap position
**v1** and **v2** are complete and deployed ([bigcorkboard.com](https://bigcorkboard.com)). **v3** is **desktop only** (Tauri save files) — no new canvas features; image nodes, themes, nested corkboards, and sync are **v4+**. See [ROADMAP.md](./ROADMAP.md).

## What to avoid
- Do not use a rich text / contenteditable editor for note bodies
- Do not register cluster-internal notes as React Flow nodes
- Do not style connection handles with default React Flow appearance
- Do not add a separate title field to NoteCard or ClusterNode
