import type { Node } from "@xyflow/react";

// Local two-player Pong. Player 1 (left) uses W/S, Player 2 (right) uses the
// arrow keys. Each paddle is an Actor with Input + Movement (axis-locked to Y).
// Fixed top/bottom bars (tagged "hwall") keep the paddles on screen and the
// ball bounces off them; the Scene's built-in left/right edge walls (tags
// "left"/"right") are the goals. The Ball modifier handles reflection, scoring
// and re-serving. Two Counter overlays show the score.

const SLOT = { width: 232 };

export const pongNodes: Node[] = [
  {
    id: "game-1",
    type: "game",
    position: { x: 1480, y: 40 },
    data: { label: "Game", width: 600, height: 400 },
  },
  {
    id: "scene-1",
    type: "scene",
    position: { x: 1140, y: 40 },
    data: {
      label: "Pong",
      width: 600,
      height: 400,
      cellSize: 20,
      showGrid: false,
      backgroundColor: "#0b0d12",
      cameraX: 300,
      cameraY: 200,
      cameraZoom: 1,
    },
  },

  // Top / bottom solid bars: stop the paddles and bounce the ball.
  {
    id: "graphicGroup-wall-top",
    type: "graphicGroup",
    position: { x: 760, y: 40 },
    data: {
      label: "Top Wall",
      groupX: 300,
      groupY: 8,
      collision: true,
      physicsType: "fixed",
      invisible: false,
      tags: ["hwall"],
      shapes: [{ id: "wt", kind: "rect", x: 0, y: 0, w: 600, h: 16, color: "gray" }],
    },
  },
  {
    id: "graphicGroup-wall-bottom",
    type: "graphicGroup",
    position: { x: 760, y: 220 },
    data: {
      label: "Bottom Wall",
      groupX: 300,
      groupY: 392,
      collision: true,
      physicsType: "fixed",
      invisible: false,
      tags: ["hwall"],
      shapes: [{ id: "wb", kind: "rect", x: 0, y: 0, w: 600, h: 16, color: "gray" }],
    },
  },

  // Player 1 paddle (left, W/S).
  {
    id: "actor-p1",
    type: "actor",
    position: { x: 40, y: 40 },
    style: { width: 240 },
    data: {
      label: "Player 1",
      pos: { x: 28, y: 200 },
      width: 14,
      height: 84,
      color: "white",
      collision: true,
      tags: ["paddle", "p1"],
    },
  },
  {
    id: "inputModifier-p1",
    type: "inputModifier",
    parentId: "actor-p1",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: { controls: "wasd" },
  },
  {
    id: "movementModifier-p1",
    type: "movementModifier",
    parentId: "actor-p1",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: { style: "velocity", speed: 300, tickMs: 150, cellSize: 20, axisLock: "y" },
  },

  // Player 2 paddle (right, arrow keys).
  {
    id: "actor-p2",
    type: "actor",
    position: { x: 340, y: 40 },
    style: { width: 240 },
    data: {
      label: "Player 2",
      pos: { x: 572, y: 200 },
      width: 14,
      height: 84,
      color: "white",
      collision: true,
      tags: ["paddle", "p2"],
    },
  },
  {
    id: "inputModifier-p2",
    type: "inputModifier",
    parentId: "actor-p2",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: { controls: "arrows" },
  },
  {
    id: "movementModifier-p2",
    type: "movementModifier",
    parentId: "actor-p2",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: { style: "velocity", speed: 300, tickMs: 150, cellSize: 20, axisLock: "y" },
  },

  // The ball.
  {
    id: "actor-ball",
    type: "actor",
    position: { x: 640, y: 40 },
    style: { width: 240 },
    data: {
      label: "Ball",
      pos: { x: 300, y: 200 },
      width: 12,
      height: 12,
      color: "white",
      collision: true,
      tags: ["ball"],
    },
  },
  {
    id: "ballModifier-1",
    type: "ballModifier",
    parentId: "actor-ball",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: {
      speed: 240,
      paddleTag: "paddle",
      wallTag: "hwall",
      centerX: 300,
      centerY: 200,
      leftEvent: "p2-scored",
      rightEvent: "p1-scored",
    },
  },

  // Score overlays.
  {
    id: "counter-p1",
    type: "counter",
    position: { x: 940, y: 40 },
    data: {
      label: "P1",
      eventName: "p1-scored",
      resetEventName: "",
      anchor: "top-left",
      color: "#ffffff",
    },
  },
  {
    id: "counter-p2",
    type: "counter",
    position: { x: 940, y: 260 },
    data: {
      label: "P2",
      eventName: "p2-scored",
      resetEventName: "",
      anchor: "top-right",
      color: "#ffffff",
    },
  },
];

export const pongEdges = [
  { id: "e-p1-s1", source: "actor-p1", target: "scene-1" },
  { id: "e-p2-s1", source: "actor-p2", target: "scene-1" },
  { id: "e-ball-s1", source: "actor-ball", target: "scene-1" },
  { id: "e-wt-s1", source: "graphicGroup-wall-top", target: "scene-1" },
  { id: "e-wb-s1", source: "graphicGroup-wall-bottom", target: "scene-1" },
  { id: "e-s1-g1", source: "scene-1", target: "game-1" },
  { id: "e-c1-g1", source: "counter-p1", target: "game-1" },
  { id: "e-c2-g1", source: "counter-p2", target: "game-1" },
];
