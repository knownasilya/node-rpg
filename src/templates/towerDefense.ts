import type { Node } from "@xyflow/react";
import { TD_PATH_1, TD_PATH_2 } from "./tdPaths";

// Tower Defense (2 levels) built from the public/adventure tilesets:
//   * Ground + dirt path  = TilesetFloor   (drawn in td-1.tmj / td-2.tmj)
//   * Decorations          = TilesetNature
//   * Base + turrets       = TilesetTowers  (12x3 @ 32px; cols 0-2 of each row
//                            are a tower's good / damaged / broken states)
//
// Creeps (slimes) spawn as a staggered wave (one actor with N instances +
// PathFollow) and march the waypoints. Turrets shoot the nearest creep in
// range. Each creep that reaches the base damages it; the base's HealthSprite
// shows good→damaged→broken and PathFollow emits "td-game-over" at 0 HP.
// Press N to advance Level 1 → Level 2.

const SLOT = { width: 232 };
const ENEMY_SHEET = "spritesheet-td-enemy";
const TOWER_SHEET = "spritesheet-td-towers";

// Helper builders to cut repetition across the two levels. ------------------
// A Wave Spawner that runs `waves` escalating waves into its scene. Each wave
// has more / faster / tougher creeps. Reads the path from the level's tiledMap
// (edit it visually there). Connects to the Game node.
function waveSpawner(idScene: string, scene: string, pathFrom: string, waves: number): Node {
  return {
    id: `waveSpawner-${idScene}`,
    type: "waveSpawner",
    position: { x: 40, y: scene === "scene-1" ? 40 : 460 },
    style: { width: 240 },
    data: {
      // Appearance/size/tags come from the connected enemy Actor prefab
      // (actor-enemy) and its child modifiers; the spawner owns the
      // escalating HP / speed / count below.
      label: `waves ${idScene}`,
      sceneId: scene,
      pathFrom,
      waves,
      count0: 5,
      countAdd: 3,
      hp0: 3,
      hpAdd: 1,
      speed0: 42,
      speedAdd: 10,
      staggerMs: 800,
      baseTag: "base",
      baseDamage: 1,
      gameOverEvent: "td-game-over",
      startEvent: "attack-phase",
      waveClearedEvent: "wave-cleared",
      levelClearedEvent: "level-cleared",
      killEvent: "enemy-killed",
    },
  };
}

function base(idScene: string, scene: string, pos: { x: number; y: number }, gameOver: string): Node[] {
  return [
    {
      id: `actor-base-${idScene}`,
      type: "actor",
      position: { x: 340, y: scene === "scene-1" ? 360 : 1020 },
      style: { width: 240 },
      data: {
        label: `base ${idScene}`,
        pos,
        width: 30,
        height: 30,
        color: "orange",
        collision: false,
        tags: ["base"],
      },
    },
    {
      id: `healthModifier-base-${idScene}`,
      type: "healthModifier",
      parentId: `actor-base-${idScene}`,
      position: { x: 4, y: 9999 },
      style: SLOT,
      data: { max: 5, onZero: "emit", emitEvent: gameOver },
    },
    {
      id: `healthSpriteModifier-base-${idScene}`,
      type: "healthSpriteModifier",
      parentId: `actor-base-${idScene}`,
      position: { x: 4, y: 9999 },
      style: SLOT,
      data: {
        spritesheetNodeId: TOWER_SHEET,
        goodFrame: 0,
        damagedFrame: 1,
        brokenFrame: 2,
        damagedBelow: 0.66,
        brokenBelow: 0.33,
      },
    },
  ];
}

export const towerDefenseNodes: Node[] = [
  // ---- Game + scenes ----------------------------------------------------
  {
    id: "game-1",
    type: "game",
    position: { x: 2520, y: 40 },
    data: { label: "Game", width: 480, height: 320 },
  },
  {
    id: "scene-1",
    type: "scene",
    position: { x: 2180, y: 40 },
    data: {
      label: "TD Level 1",
      width: 480,
      height: 320,
      cellSize: 16,
      showGrid: false,
      backgroundColor: "#243027",
      cameraX: 240,
      cameraY: 160,
      cameraZoom: 1,
    },
  },
  {
    id: "scene-2",
    type: "scene",
    position: { x: 2180, y: 420 },
    data: {
      label: "TD Level 2",
      width: 480,
      height: 320,
      cellSize: 16,
      showGrid: false,
      backgroundColor: "#243027",
      cameraX: 240,
      cameraY: 160,
      cameraZoom: 1,
    },
  },
  {
    id: "scene-game-over",
    type: "scene",
    position: { x: 2180, y: 800 },
    data: {
      label: "Game Over",
      width: 480,
      height: 320,
      cellSize: 16,
      showGrid: false,
      backgroundColor: "#1a1a26",
      cameraX: 240,
      cameraY: 160,
      cameraZoom: 1,
    },
  },
  {
    id: "tiledMap-td1",
    type: "tiledMap",
    position: { x: 1840, y: 40 },
    data: { label: "TD Map 1", src: "/maps/td-1.tmj", spawnObjects: false, posX: 0, posY: 0, pathWaypoints: TD_PATH_1 },
  },
  {
    id: "tiledMap-td2",
    type: "tiledMap",
    position: { x: 1840, y: 420 },
    data: { label: "TD Map 2", src: "/maps/td-2.tmj", spawnObjects: false, posX: 0, posY: 0, pathWaypoints: TD_PATH_2 },
  },

  // ---- Shared asset chains ----------------------------------------------
  {
    id: "image-td-towers",
    type: "image",
    position: { x: 640, y: 40 },
    data: { label: "Towers", src: "/adventure/Backgrounds/Tilesets/TilesetTowers.png" },
  },
  {
    id: TOWER_SHEET,
    type: "spritesheet",
    position: { x: 980, y: 40 },
    data: { label: "Towers Sheet", columns: 12, rows: 3, frameWidth: 32, frameHeight: 32, margin: 0, spacing: 0 },
  },
  {
    id: "image-td-enemy",
    type: "image",
    position: { x: 640, y: 220 },
    data: { label: "Creep", src: "/adventure/Actor/Monster/Slime/Slime.png" },
  },
  {
    id: ENEMY_SHEET,
    type: "spritesheet",
    position: { x: 980, y: 220 },
    data: { label: "Creep Sheet", columns: 4, rows: 4, frameWidth: 16, frameHeight: 16, margin: 0, spacing: 0 },
  },
  {
    id: "animation-td-enemy",
    type: "animation",
    position: { x: 1320, y: 220 },
    data: { label: "Creep Walk", frames: [0, 4, 8, 12], frameDurationMs: 160, strategy: "loop" },
  },

  // ---- Enemy prefab (shared by both levels) ------------------------------
  // The creep "type": a template Actor the wave spawners clone. Its look comes
  // from the animation modifier below; size/tags/collision live here. It has
  // NO scene edge, so it never spawns itself — the spawners do, registering
  // each creep under this node's instance keys so the modifier attaches.
  {
    id: "actor-enemy",
    type: "actor",
    position: { x: 980, y: 420 },
    style: { width: 240 },
    data: {
      label: "creep",
      pos: { x: 0, y: 0 },
      width: 16,
      height: 16,
      color: "green",
      collision: false,
      tags: ["enemy"],
    },
  },
  {
    id: "animationModifier-enemy",
    type: "animationModifier",
    parentId: "actor-enemy",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: {
      states: {
        idle: "animation-td-enemy",
        run: "animation-td-enemy",
      },
      flipOnDirection: false,
    },
  },

  // ---- Level 1 entities --------------------------------------------------
  waveSpawner("l1", "scene-1", "tiledMap-td1", 3),
  ...base("l1", "scene-1", { x: TD_PATH_1[TD_PATH_1.length - 1].x, y: TD_PATH_1[TD_PATH_1.length - 1].y }, "td-game-over"),
  // Wave cleared on Level 1 -> advance to Level 2.
  {
    id: "sceneSwitchModifier-next1",
    type: "sceneSwitchModifier",
    parentId: "actor-base-l1",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: { eventName: "level-cleared", keyCode: "", targetSceneId: "scene-2", onlyInScene: "scene-1", alsoReset: false },
  },
  // Base destroyed -> game over.
  {
    id: "sceneSwitchModifier-dead1",
    type: "sceneSwitchModifier",
    parentId: "actor-base-l1",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: { eventName: "td-game-over", keyCode: "", targetSceneId: "scene-game-over", onlyInScene: "", alsoReset: false },
  },

  // ---- Level 2 entities --------------------------------------------------
  waveSpawner("l2", "scene-2", "tiledMap-td2", 4),
  ...base("l2", "scene-2", { x: TD_PATH_2[TD_PATH_2.length - 1].x, y: TD_PATH_2[TD_PATH_2.length - 1].y }, "td-game-over"),
  // Wave cleared on Level 2 -> loop back to Level 1.
  {
    id: "sceneSwitchModifier-next2",
    type: "sceneSwitchModifier",
    parentId: "actor-base-l2",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: { eventName: "level-cleared", keyCode: "", targetSceneId: "scene-1", onlyInScene: "scene-2", alsoReset: false },
  },

  // ---- State machine (BUILD -> ATTACK -> CLEARED, looping) --------------
  {
    id: "stateMachine-td",
    type: "stateMachine",
    position: { x: 2860, y: 220 },
    data: {
      label: "Round States",
      initial: "BUILD",
      resetEvent: "td-restart",
      states: [
        { name: "BUILD", hint: "place towers", enterEvent: "build-phase" },
        { name: "ATTACK", hint: "defend!", enterEvent: "attack-phase" },
      ],
      transitions: [
        // Build -> Attack: auto after 15s, or early via READY ("ready") / SPACE.
        { from: "BUILD", to: "ATTACK", key: "Space", event: "ready", ms: 15000 },
        // Each cleared wave loops back to build for the next (tougher) wave.
        { from: "ATTACK", to: "BUILD", event: "wave-cleared" },
        // After the final wave the spawner emits level-cleared: reset to build
        // (the sceneSwitch advances to the next level in parallel).
        { from: "*", to: "BUILD", event: "level-cleared" },
      ],
    },
  },

  // ---- Toolbar / economy (bottom bar in play, during BUILD) -------------
  // General Toolbar node: three "place" items (towers, cost-gated so pricier
  // ones unlock as you bank kill points) + an "emit" item for READY.
  {
    id: "toolbar-td",
    type: "toolbar",
    position: { x: 2860, y: 460 },
    data: {
      label: "Build Toolbar",
      activeState: "BUILD",
      hideOnScenes: ["scene-game-over"],
      anchor: "bottom",
      orientation: "horizontal",
      startingPoints: 80,
      earnEvent: "enemy-killed",
      earnAmount: 14,
      iconSheetId: TOWER_SHEET,
      items: [
        { label: "Pebble", kind: "place", cost: 20, iconFrame: 9, spawnTags: ["tower"], behavior: "tower", range: 70, damage: 1, cooldownMs: 700, targetTag: "enemy" },
        { label: "Cannon", kind: "place", cost: 45, iconFrame: 6, spawnTags: ["tower"], behavior: "tower", range: 88, damage: 2, cooldownMs: 900, targetTag: "enemy" },
        { label: "Sniper", kind: "place", cost: 75, iconFrame: 3, spawnTags: ["tower"], behavior: "tower", range: 140, damage: 3, cooldownMs: 1200, targetTag: "enemy" },
        { label: "READY ▶", kind: "emit", event: "ready" },
      ],
    },
  },

  // ---- Score + Game Over screen -----------------------------------------
  {
    id: "counter-kills",
    type: "counter",
    position: { x: 2860, y: 40 },
    data: { label: "Kills", eventName: "enemy-killed", resetEventName: "", anchor: "top-left", color: "#ffe066" },
  },
  {
    id: "graphicGroup-gameover",
    type: "graphicGroup",
    position: { x: 640, y: 800 },
    data: {
      label: "Game Over Text",
      groupX: 240,
      groupY: 130,
      collision: false,
      physicsType: "passive",
      invisible: false,
      tags: [],
      shapes: [
        { id: "go-bg", kind: "rect", x: 0, y: 0, w: 300, h: 90, color: "black" },
        { id: "go-title", kind: "text", x: -92, y: -22, text: "GAME OVER", size: 30, color: "red" },
      ],
    },
  },
  {
    id: "actor-restart-btn",
    type: "actor",
    position: { x: 940, y: 800 },
    style: { width: 240 },
    data: {
      label: "Restart Button",
      pos: { x: 240, y: 210 },
      width: 160,
      height: 44,
      color: "yellow",
      collision: true,
      invisible: true,
      tags: ["restart-button"],
    },
  },
  {
    id: "clickModifier-restart",
    type: "clickModifier",
    parentId: "actor-restart-btn",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: { eventName: "td-restart", hoverCursor: true },
  },
  {
    id: "graphicGroup-restart-visual",
    type: "graphicGroup",
    position: { x: 1240, y: 800 },
    data: {
      label: "Restart Button Skin",
      groupX: 240,
      groupY: 210,
      collision: false,
      physicsType: "passive",
      invisible: false,
      tags: [],
      shapes: [
        { id: "rb-bg", kind: "rect", x: 0, y: 0, w: 160, h: 44, color: "white" },
        { id: "rb-label", kind: "text", x: -44, y: -10, text: "RESTART", size: 18, color: "black" },
      ],
    },
  },
  {
    id: "sceneSwitchModifier-restart",
    type: "sceneSwitchModifier",
    parentId: "actor-restart-btn",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: { eventName: "td-restart", keyCode: "", targetSceneId: "scene-1", onlyInScene: "scene-game-over", alsoReset: true },
  },
];

export const towerDefenseEdges = [
  // Maps -> scenes.
  { id: "e-td1-s1", source: "tiledMap-td1", target: "scene-1" },
  { id: "e-td2-s2", source: "tiledMap-td2", target: "scene-2" },
  // Asset chains.
  { id: "e-td-tow-img-sheet", source: "image-td-towers", target: TOWER_SHEET },
  { id: "e-td-enemy-img-sheet", source: "image-td-enemy", target: ENEMY_SHEET },
  { id: "e-td-enemy-sheet-anim", source: ENEMY_SHEET, target: "animation-td-enemy" },
  // Enemy prefab feeds both wave spawners (creeps are clones of it).
  { id: "e-enemy-wave-l1", source: "actor-enemy", target: "waveSpawner-l1" },
  { id: "e-enemy-wave-l2", source: "actor-enemy", target: "waveSpawner-l2" },
  // Level 1 entities -> scene-1.
  { id: "e-base-l1-s1", source: "actor-base-l1", target: "scene-1" },
  { id: "e-wave-l1-g1", source: "waveSpawner-l1", target: "game-1" },
  // Level 2 entities -> scene-2.
  { id: "e-base-l2-s2", source: "actor-base-l2", target: "scene-2" },
  { id: "e-wave-l2-g1", source: "waveSpawner-l2", target: "game-1" },
  // Scenes -> Game.
  { id: "e-s1-g1", source: "scene-1", target: "game-1" },
  { id: "e-s2-g1", source: "scene-2", target: "game-1" },
  { id: "e-go-g1", source: "scene-game-over", target: "game-1" },
  // State machine HUD + build menu + counter + game over screen.
  { id: "e-sm-g1", source: "stateMachine-td", target: "game-1" },
  { id: "e-toolbar-g1", source: "toolbar-td", target: "game-1" },
  { id: "e-kills-g1", source: "counter-kills", target: "game-1" },
  { id: "e-go-text-s", source: "graphicGroup-gameover", target: "scene-game-over" },
  { id: "e-go-btn-s", source: "actor-restart-btn", target: "scene-game-over" },
  { id: "e-go-btn-visual-s", source: "graphicGroup-restart-visual", target: "scene-game-over" },
];
