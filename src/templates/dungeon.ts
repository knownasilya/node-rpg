import type { Node } from "@xyflow/react";

// Top-down dungeon crawler template. Built from the public/adventure art pack:
//   * Player  = Actor/Character/Boy/SeparateAnim (16x16: Idle 4x1, Walk 4x4, Attack 4x1)
//   * Enemies = Character/Skeleton/SeparateAnim + Monster/Slime.png (16x16)
//   * Floor   = Backgrounds/Tilesets/TilesetFloor.png   (gid >= 241 in the .tmj)
//   * Walls   = Backgrounds/Tilesets/TilesetRelief.png  (gid 1..240, layer solid:true)
//
// Levels are driven by Tiled maps (public/maps/dungeon-1.tmj, dungeon-2.tmj).
// Tiled object `class` is matched against actor `tags` (scene.tsx), so a single
// actor node per class spawns one instance per map object:
//   player -> actor-player, skeleton -> actor-skeleton, slime -> actor-slime,
//   stairs -> actor-stairs (level 1), stairs-back -> actor-stairs-back (level 2).
//
// Combat is action-style: enemies CHASE the player (chaseModifier) and deal
// contact damage (always-on hitbox); the player swings an omnidirectional melee
// attack (J) to kill them. Health shows as heart pips in the Game overlay.
// No gravity/ground/jump — movement is 8-directional velocity.

const SLOT = { width: 232 };

export const dungeonNodes: Node[] = [
  // ---- Game + scenes -----------------------------------------------------
  {
    id: "game-1",
    type: "game",
    position: { x: 2880, y: 40 },
    data: { label: "Game", width: 480, height: 320 },
  },
  {
    id: "scene-1",
    type: "scene",
    position: { x: 2520, y: 40 },
    data: {
      label: "Dungeon Level 1",
      width: 480,
      height: 320,
      cellSize: 16,
      showGrid: false,
      backgroundColor: "#1a1a26",
      cameraX: 240,
      cameraY: 160,
      cameraZoom: 2,
    },
  },
  {
    id: "scene-2",
    type: "scene",
    position: { x: 2520, y: 420 },
    data: {
      label: "Dungeon Level 2",
      width: 480,
      height: 320,
      cellSize: 16,
      showGrid: false,
      backgroundColor: "#16161f",
      cameraX: 240,
      cameraY: 160,
      cameraZoom: 2,
    },
  },
  {
    id: "scene-game-over",
    type: "scene",
    position: { x: 2520, y: 800 },
    data: {
      label: "Game Over",
      width: 480,
      height: 320,
      cellSize: 16,
      showGrid: false,
      backgroundColor: "#0b0d12",
      cameraX: 240,
      cameraY: 160,
      cameraZoom: 1,
    },
  },
  {
    id: "tiledMap-d1",
    type: "tiledMap",
    position: { x: 2180, y: 40 },
    data: {
      label: "Dungeon 1 Map",
      src: "/maps/dungeon-1.tmj",
      spawnObjects: true,
      posX: 0,
      posY: 0,
    },
  },
  {
    id: "tiledMap-d2",
    type: "tiledMap",
    position: { x: 2180, y: 420 },
    data: {
      label: "Dungeon 2 Map",
      src: "/maps/dungeon-2.tmj",
      spawnObjects: true,
      posX: 0,
      posY: 0,
    },
  },

  // ---- Player ------------------------------------------------------------
  {
    id: "actor-player",
    type: "actor",
    position: { x: 40, y: 40 },
    style: { width: 240 },
    data: {
      label: "player",
      pos: { x: 48, y: 48 },
      color: "blue",
      collision: true,
      tags: ["player"],
      instances: [],
    },
  },
  {
    id: "inputModifier-player",
    type: "inputModifier",
    parentId: "actor-player",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: { controls: "wasd" },
  },
  {
    id: "movementModifier-player",
    type: "movementModifier",
    parentId: "actor-player",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: { style: "velocity", speed: 70, tickMs: 150, cellSize: 16 },
  },
  {
    id: "directionalAnimationModifier-player",
    type: "directionalAnimationModifier",
    parentId: "actor-player",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: {
      idleSheet: "spritesheet-boy-idle",
      walkSheet: "spritesheet-boy-walk",
      attackSheet: "spritesheet-boy-attack",
      frameDurationMs: 110,
      attackEvent: "player-attacked",
      attackMs: 250,
    },
  },
  {
    id: "hurtboxModifier-player",
    type: "hurtboxModifier",
    parentId: "actor-player",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: {
      shapes: [{ x: -6, y: -6, w: 12, h: 12 }],
      tags: ["player"],
      iFrameMs: 700,
    },
  },
  {
    id: "healthModifier-player",
    type: "healthModifier",
    parentId: "actor-player",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: { max: 5, onZero: "emit", emitEvent: "player-died" },
  },
  {
    id: "attackModifier-player",
    type: "attackModifier",
    parentId: "actor-player",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: {
      attackKey: "KeyJ",
      durationMs: 250,
      damage: 1,
      reach: 16,
      boxHeight: 16,
      hitboxMode: "direction",
      targetTags: ["enemy"],
      emitEvent: "player-attacked",
    },
  },
  {
    id: "cameraFollowModifier-player",
    type: "cameraFollowModifier",
    parentId: "actor-player",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: {
      followX: true,
      followY: true,
      deadW: 24,
      deadH: 24,
      lerp: 0.18,
      offsetX: 0,
      offsetY: 0,
    },
  },
  // Stairs collision rules: level-1 stairs -> scene-2, level-2 stairs -> scene-1.
  {
    id: "collisionRuleModifier-stairs-down",
    type: "collisionRuleModifier",
    parentId: "actor-player",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: {
      target: "stairs",
      action: "switchScene",
      targetSceneId: "scene-2",
      sceneSpawnX: 48,
      sceneSpawnY: 272,
    },
  },
  {
    id: "collisionRuleModifier-stairs-up",
    type: "collisionRuleModifier",
    parentId: "actor-player",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: {
      target: "stairs-back",
      action: "switchScene",
      targetSceneId: "scene-1",
      sceneSpawnX: 48,
      sceneSpawnY: 48,
    },
  },
  {
    id: "sceneSwitchModifier-die",
    type: "sceneSwitchModifier",
    parentId: "actor-player",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: {
      eventName: "player-died",
      keyCode: "",
      targetSceneId: "scene-game-over",
      onlyInScene: "",
      alsoReset: false,
    },
  },
  {
    id: "sceneSwitchModifier-restart",
    type: "sceneSwitchModifier",
    parentId: "actor-player",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: {
      eventName: "restart-clicked",
      keyCode: "",
      targetSceneId: "scene-1",
      onlyInScene: "scene-game-over",
      alsoReset: true,
    },
  },

  // ---- Player asset chains ----------------------------------------------
  {
    id: "image-boy-idle",
    type: "image",
    position: { x: 640, y: 40 },
    data: {
      label: "Boy Idle",
      src: "/adventure/Actor/Character/Boy/SeparateAnim/Idle.png",
    },
  },
  {
    id: "spritesheet-boy-idle",
    type: "spritesheet",
    position: { x: 980, y: 40 },
    data: {
      label: "Boy Idle Sheet",
      columns: 4,
      rows: 1,
      frameWidth: 16,
      frameHeight: 16,
      margin: 0,
      spacing: 0,
    },
  },
  {
    id: "image-boy-walk",
    type: "image",
    position: { x: 640, y: 200 },
    data: {
      label: "Boy Walk",
      src: "/adventure/Actor/Character/Boy/SeparateAnim/Walk.png",
    },
  },
  {
    id: "spritesheet-boy-walk",
    type: "spritesheet",
    position: { x: 980, y: 200 },
    data: {
      label: "Boy Walk Sheet",
      columns: 4,
      rows: 4,
      frameWidth: 16,
      frameHeight: 16,
      margin: 0,
      spacing: 0,
    },
  },
  {
    id: "image-boy-attack",
    type: "image",
    position: { x: 640, y: 360 },
    data: {
      label: "Boy Attack",
      src: "/adventure/Actor/Character/Boy/SeparateAnim/Attack.png",
    },
  },
  {
    id: "spritesheet-boy-attack",
    type: "spritesheet",
    position: { x: 980, y: 360 },
    data: {
      label: "Boy Attack Sheet",
      columns: 4,
      rows: 1,
      frameWidth: 16,
      frameHeight: 16,
      margin: 0,
      spacing: 0,
    },
  },

  // ---- Skeleton enemy ----------------------------------------------------
  {
    id: "actor-skeleton",
    type: "actor",
    position: { x: 40, y: 560 },
    style: { width: 240 },
    data: {
      label: "skeleton",
      pos: { x: 320, y: 64 },
      color: "gray",
      collision: true,
      tags: ["enemy", "skeleton"],
      instances: [],
    },
  },
  {
    id: "movementModifier-skeleton",
    type: "movementModifier",
    parentId: "actor-skeleton",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: { style: "velocity", speed: 45, tickMs: 150, cellSize: 16 },
  },
  {
    id: "chaseModifier-skeleton",
    type: "chaseModifier",
    parentId: "actor-skeleton",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: { targetTag: "player", aggroRange: 90 },
  },
  {
    id: "directionalAnimationModifier-skeleton",
    type: "directionalAnimationModifier",
    parentId: "actor-skeleton",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: {
      idleSheet: "spritesheet-skel-idle",
      walkSheet: "spritesheet-skel-walk",
      attackSheet: "",
      frameDurationMs: 130,
      attackEvent: "",
      attackMs: 250,
    },
  },
  {
    id: "hurtboxModifier-skeleton",
    type: "hurtboxModifier",
    parentId: "actor-skeleton",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: {
      shapes: [{ x: -7, y: -7, w: 14, h: 14 }],
      tags: ["enemy"],
      iFrameMs: 250,
    },
  },
  {
    id: "healthModifier-skeleton",
    type: "healthModifier",
    parentId: "actor-skeleton",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: { max: 2, onZero: "kill", emitEvent: "" },
  },
  {
    id: "hitboxModifier-skeleton",
    type: "hitboxModifier",
    parentId: "actor-skeleton",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: {
      shapes: [{ x: -7, y: -7, w: 14, h: 14 }],
      damage: 1,
      targetTags: ["player"],
      active: true,
    },
  },

  // ---- Skeleton asset chains --------------------------------------------
  {
    id: "image-skel-idle",
    type: "image",
    position: { x: 640, y: 560 },
    data: {
      label: "Skeleton Idle",
      src: "/adventure/Actor/Character/Skeleton/SeparateAnim/Idle.png",
    },
  },
  {
    id: "spritesheet-skel-idle",
    type: "spritesheet",
    position: { x: 980, y: 560 },
    data: {
      label: "Skeleton Idle Sheet",
      columns: 4,
      rows: 1,
      frameWidth: 16,
      frameHeight: 16,
      margin: 0,
      spacing: 0,
    },
  },
  {
    id: "image-skel-walk",
    type: "image",
    position: { x: 640, y: 720 },
    data: {
      label: "Skeleton Walk",
      src: "/adventure/Actor/Character/Skeleton/SeparateAnim/Walk.png",
    },
  },
  {
    id: "spritesheet-skel-walk",
    type: "spritesheet",
    position: { x: 980, y: 720 },
    data: {
      label: "Skeleton Walk Sheet",
      columns: 4,
      rows: 4,
      frameWidth: 16,
      frameHeight: 16,
      margin: 0,
      spacing: 0,
    },
  },

  // ---- Slime enemy -------------------------------------------------------
  {
    id: "actor-slime",
    type: "actor",
    position: { x: 40, y: 1040 },
    style: { width: 240 },
    data: {
      label: "slime",
      pos: { x: 384, y: 160 },
      color: "green",
      collision: true,
      tags: ["enemy", "slime"],
      instances: [],
    },
  },
  {
    id: "movementModifier-slime",
    type: "movementModifier",
    parentId: "actor-slime",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: { style: "velocity", speed: 32, tickMs: 150, cellSize: 16 },
  },
  {
    id: "chaseModifier-slime",
    type: "chaseModifier",
    parentId: "actor-slime",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: { targetTag: "player", aggroRange: 80 },
  },
  {
    id: "directionalAnimationModifier-slime",
    type: "directionalAnimationModifier",
    parentId: "actor-slime",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: {
      idleSheet: "",
      walkSheet: "spritesheet-slime",
      attackSheet: "",
      frameDurationMs: 160,
      attackEvent: "",
      attackMs: 250,
    },
  },
  {
    id: "hurtboxModifier-slime",
    type: "hurtboxModifier",
    parentId: "actor-slime",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: {
      shapes: [{ x: -7, y: -6, w: 14, h: 12 }],
      tags: ["enemy"],
      iFrameMs: 250,
    },
  },
  {
    id: "healthModifier-slime",
    type: "healthModifier",
    parentId: "actor-slime",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: { max: 3, onZero: "kill", emitEvent: "" },
  },
  {
    id: "hitboxModifier-slime",
    type: "hitboxModifier",
    parentId: "actor-slime",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: {
      shapes: [{ x: -7, y: -6, w: 14, h: 12 }],
      damage: 1,
      targetTags: ["player"],
      active: true,
    },
  },
  {
    id: "image-slime",
    type: "image",
    position: { x: 640, y: 1040 },
    data: {
      label: "Slime",
      src: "/adventure/Actor/Monster/Slime/Slime.png",
    },
  },
  {
    id: "spritesheet-slime",
    type: "spritesheet",
    position: { x: 980, y: 1040 },
    data: {
      label: "Slime Sheet",
      columns: 4,
      rows: 4,
      frameWidth: 16,
      frameHeight: 16,
      margin: 0,
      spacing: 0,
    },
  },

  // ---- Patrolling skeletons (vertical patrol, no chase) -----------------
  // Not a .tmj object class, so these spawn from the template `instances`
  // below (one Actor per entry). The Patrol modifier randomizes range/speed/
  // phase per instance, so they don't bob in lockstep. Reuses the skeleton
  // sheets already wired above.
  {
    id: "actor-skeleton-patrol",
    type: "actor",
    position: { x: 40, y: 1520 },
    style: { width: 240 },
    data: {
      label: "skeleton (patrol)",
      pos: { x: 416, y: 112 },
      color: "gray",
      collision: true,
      tags: ["enemy", "skeleton-patrol"],
      instances: [
        { id: "sp1", x: 400, y: 96 },
        { id: "sp2", x: 432, y: 160 },
        { id: "sp3", x: 416, y: 224 },
      ],
    },
  },
  {
    id: "patrolModifier-skeleton-patrol",
    type: "patrolModifier",
    parentId: "actor-skeleton-patrol",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: {
      speed: 34,
      range: 48,
      startDirection: "right",
      pauseAtTurnMs: 250,
      stayOnPlatform: false,
      axis: "vertical",
    },
  },
  {
    id: "directionalAnimationModifier-skeleton-patrol",
    type: "directionalAnimationModifier",
    parentId: "actor-skeleton-patrol",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: {
      idleSheet: "spritesheet-skel-idle",
      walkSheet: "spritesheet-skel-walk",
      attackSheet: "",
      frameDurationMs: 140,
      attackEvent: "",
      attackMs: 250,
    },
  },
  {
    id: "hurtboxModifier-skeleton-patrol",
    type: "hurtboxModifier",
    parentId: "actor-skeleton-patrol",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: {
      shapes: [{ x: -7, y: -7, w: 14, h: 14 }],
      tags: ["enemy"],
      iFrameMs: 250,
    },
  },
  {
    id: "healthModifier-skeleton-patrol",
    type: "healthModifier",
    parentId: "actor-skeleton-patrol",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: { max: 2, onZero: "kill", emitEvent: "" },
  },
  {
    id: "hitboxModifier-skeleton-patrol",
    type: "hitboxModifier",
    parentId: "actor-skeleton-patrol",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: {
      shapes: [{ x: -7, y: -7, w: 14, h: 14 }],
      damage: 1,
      targetTags: ["player"],
      active: true,
    },
  },

  // ---- Stairs (level transitions) ---------------------------------------
  {
    id: "actor-stairs",
    type: "actor",
    position: { x: 40, y: 1480 },
    style: { width: 240 },
    data: {
      label: "stairs down",
      pos: { x: 432, y: 272 },
      color: "yellow",
      collision: true,
      tags: ["stairs"],
      instances: [],
    },
  },
  {
    id: "actor-stairs-back",
    type: "actor",
    position: { x: 340, y: 1480 },
    style: { width: 240 },
    data: {
      label: "stairs up",
      pos: { x: 432, y: 32 },
      color: "orange",
      collision: true,
      tags: ["stairs-back"],
      instances: [],
    },
  },

  // ---- Game Over screen --------------------------------------------------
  {
    id: "graphicGroup-gameover",
    type: "graphicGroup",
    position: { x: 640, y: 1480 },
    data: {
      label: "Game Over Text",
      groupX: 240,
      groupY: 130,
      collision: false,
      physicsType: "passive",
      invisible: false,
      tags: [],
      shapes: [
        { id: "go-bg", kind: "rect", x: 0, y: 0, w: 280, h: 90, color: "black" },
        {
          id: "go-title",
          kind: "text",
          x: -86,
          y: -22,
          text: "GAME OVER",
          size: 28,
          color: "red",
        },
      ],
    },
  },
  {
    id: "actor-restart-btn",
    type: "actor",
    position: { x: 940, y: 1480 },
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
      instances: [],
    },
  },
  {
    id: "clickModifier-restart-btn",
    type: "clickModifier",
    parentId: "actor-restart-btn",
    position: { x: 4, y: 9999 },
    style: SLOT,
    data: { eventName: "restart-clicked", hoverCursor: true },
  },
  {
    id: "graphicGroup-restart-visual",
    type: "graphicGroup",
    position: { x: 1240, y: 1480 },
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
        {
          id: "rb-label",
          kind: "text",
          x: -44,
          y: -10,
          text: "RESTART",
          size: 18,
          color: "black",
        },
      ],
    },
  },
];

export const dungeonEdges = [
  // Player asset chains (image -> spritesheet; the directional anim modifier
  // builds idle/walk/attack straight from the sheets, no animation nodes).
  { id: "e-boy-idle-img-sheet", source: "image-boy-idle", target: "spritesheet-boy-idle" },
  { id: "e-boy-walk-img-sheet", source: "image-boy-walk", target: "spritesheet-boy-walk" },
  { id: "e-boy-atk-img-sheet", source: "image-boy-attack", target: "spritesheet-boy-attack" },
  // Skeleton asset chains.
  { id: "e-skel-idle-img-sheet", source: "image-skel-idle", target: "spritesheet-skel-idle" },
  { id: "e-skel-walk-img-sheet", source: "image-skel-walk", target: "spritesheet-skel-walk" },
  // Slime asset chain.
  { id: "e-slime-img-sheet", source: "image-slime", target: "spritesheet-slime" },

  // Tiled maps -> scenes.
  { id: "e-d1-s1", source: "tiledMap-d1", target: "scene-1" },
  { id: "e-d2-s2", source: "tiledMap-d2", target: "scene-2" },

  // Player + enemies live in both gameplay scenes (class->tag projection
  // fills per-scene instances from each .tmj).
  { id: "e-player-s1", source: "actor-player", target: "scene-1" },
  { id: "e-player-s2", source: "actor-player", target: "scene-2" },
  { id: "e-skel-s1", source: "actor-skeleton", target: "scene-1" },
  { id: "e-skel-s2", source: "actor-skeleton", target: "scene-2" },
  { id: "e-slime-s1", source: "actor-slime", target: "scene-1" },
  { id: "e-slime-s2", source: "actor-slime", target: "scene-2" },
  // Patrolling skeletons (template instances) live in level 1.
  { id: "e-skelpat-s1", source: "actor-skeleton-patrol", target: "scene-1" },

  // Stairs: down only in level 1, up only in level 2.
  { id: "e-stairs-s1", source: "actor-stairs", target: "scene-1" },
  { id: "e-stairs-back-s2", source: "actor-stairs-back", target: "scene-2" },

  // Scenes -> Game.
  { id: "e-s1-g1", source: "scene-1", target: "game-1" },
  { id: "e-s2-g1", source: "scene-2", target: "game-1" },
  { id: "e-go-g1", source: "scene-game-over", target: "game-1" },

  // Game Over screen contents.
  { id: "e-go-text-s", source: "graphicGroup-gameover", target: "scene-game-over" },
  { id: "e-go-btn-s", source: "actor-restart-btn", target: "scene-game-over" },
  { id: "e-go-btn-visual-s", source: "graphicGroup-restart-visual", target: "scene-game-over" },
];
