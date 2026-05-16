import type { Node } from "@xyflow/react";
import { snakeNodes, snakeEdges } from "./snake";
import { platformerNodes, platformerEdges } from "./platformer";

export type TemplateName = "snake" | "platformer";
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
};

export const TEMPLATE_ORDER: TemplateName[] = ["snake", "platformer"];

const STORAGE_KEY = "nodeRpgTemplate";

export function readStoredTemplate(): TemplateName {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "snake" || raw === "platformer") return raw;
  } catch {}
  return "snake";
}

export function writeStoredTemplate(name: TemplateName): void {
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {}
}
