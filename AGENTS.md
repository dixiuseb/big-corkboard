<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->


# Big Corkboard — AI Agent Context

## Project overview
A digital corkboard for writing project planning. Infinite canvas with 
standalone notecards and expandable cluster nodes. See README.md for 
full spec and data model.

## Stack
- Next.js (App Router) + React + TypeScript
- React Flow (@xyflow/react) for the canvas
- Tailwind CSS for styling
- localStorage for persistence (v1)

## Critical conventions
- Use `BoardEdge` not `Connection` — avoids collision with React Flow's 
  own Connection type
- Formatting is **whole-note only** — no inline rich text ranges, no 
  contenteditable, just boolean flags on the NoteCard object
- Notes inside clusters are NOT canvas nodes — they live in 
  ClusterNode.notes[] and are not registered with React Flow
- Handles appear on hover only, styled as a darker shade of the node's 
  own color — never default black React Flow handles

## Color palette (pastel backgrounds, stone-800 text)
- amber: #FAEEDA
- sky:   #E6F1FB
- teal:  #E1F5EE
- rose:  #FBEAF0
- violet:#F0EAFB
- lime:  #EDF9E1

## Persistence keys
- `corkboard:boards` — ordered array of { id, title }
- `corkboard:board:{id}` — full canvas state per board

## Current roadmap position
Steps 1–7 done. Currently on step 9 (drag to unpin).
See README.md for full roadmap.

## What to avoid
- Do not use a rich text / contenteditable editor for note bodies
- Do not register cluster-internal notes as React Flow nodes
- Do not style connection handles with default React Flow appearance
- Do not add a separate title field to NoteCard or ClusterNode