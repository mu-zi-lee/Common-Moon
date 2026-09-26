import { createFileRoute } from "@tanstack/react-router";
import { GameApp } from "@/game/GameApp";
import { ProjectApp } from "@/game/ProjectApp";

function Home() {
  return new URLSearchParams(window.location.search).has("tutorial") ? <GameApp /> : <ProjectApp />;
}

export const Route = createFileRoute("/_authenticated/")({
  ssr: false,
  component: Home,
});
