"use client";

// Board uses localStorage for persistence, which is browser-only.
// ssr: false prevents Next.js from rendering it on the server and avoids
// hydration mismatches when restoring saved canvas state.
import dynamic from "next/dynamic";

const Board = dynamic(
  () => import("@/components/Board").then((m) => m.Board),
  { ssr: false },
);

export default function Home() {
  return <Board />;
}
