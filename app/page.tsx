"use client";

import { LandingPage } from "@/components/LandingPage";
import { GameTable } from "@/components/GameTable";
import { useGameStore } from "@/store/use-game-store";

export default function Home() {
  const gamePhase = useGameStore((s) => s.gamePhase);

  // Show game table when a game is active, landing page otherwise
  if (gamePhase !== "idle") {
    return <GameTable />;
  }

  return <LandingPage />;
}
