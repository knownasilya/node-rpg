import type { Node } from "@xyflow/react";
import { snakeNodes, snakeEdges } from "./snake";
import { platformerNodes, platformerEdges } from "./platformer";
import {
  tiledPlatformerNodes,
  tiledPlatformerEdges,
} from "./tiledPlatformer";
import { dungeonNodes, dungeonEdges } from "./dungeon";

export type TemplateName =
  | "snake"
  | "platformer"
  | "tiledPlatformer"
  | "dungeon";
export type TemplateEdge = { id: string; source: string; target: string };
export interface Template {
  name: TemplateName;
  label: string;
  nodes: Node[];
  edges: TemplateEdge[];
}

export const TEMPLATES: Record<TemplateName, Template> = {
  snake: {
    name: "snake",
    label: "Snake",
    nodes: snakeNodes,
    edges: snakeEdges,
  },
  platformer: {
    name: "platformer",
    label: "Platformer",
    nodes: platformerNodes,
    edges: platformerEdges,
  },
  tiledPlatformer: {
    name: "tiledPlatformer",
    label: "Tiled Platformer",
    nodes: tiledPlatformerNodes,
    edges: tiledPlatformerEdges,
  },
  dungeon: {
    name: "dungeon",
    label: "Dungeon",
    nodes: dungeonNodes,
    edges: dungeonEdges,
  },
};

export const TEMPLATE_ORDER: TemplateName[] = [
  "snake",
  "platformer",
  "tiledPlatformer",
  "dungeon",
];

const STORAGE_KEY = "nodeRpgTemplate";

export function readStoredTemplate(): TemplateName {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (
      raw === "snake" ||
      raw === "platformer" ||
      raw === "tiledPlatformer" ||
      raw === "dungeon"
    )
      return raw;
  } catch {}
  return "snake";
}

export function writeStoredTemplate(name: TemplateName): void {
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {}
}
