import type { Node } from "@xyflow/react";

// Tiled-driven platformer template. Wires up asset nodes (Image →
// Spritesheet → Animation, plus Sound and TiledMap) and connects them to a
// player with the full platformer modifier stack. The Tiled map src and
// asset srcs are left blank by default — point them at files under public/
// to bring the scene to life. A fallback floor graphicGroup is included so
// the player still has ground to stand on before any map is loaded.

export const tiledPlatformerNodes: Node[] = [
  {
    id: "game-1",
    type: "game",
    position: { x: 1480, y: 40 },
    data: { label: "Game", width: 640, height: 360 },
  },
  {
    id: "scene-1",
    type: "scene",
    position: { x: 1160, y: 40 },
    data: {
      label: "Tiled Level 1",
      width: 1600,
      height: 600,
      cellSize: 32,
      showGrid: false,
      backgroundColor: "blue",
      cameraX: 320,
      cameraY: 240,
      cameraZoom: 1,
    },
  },
  // Player + platformer modifier stack ----------------------------------
  {
    id: "actor-1",
    type: "actor",
    position: { x: 40, y: 40 },
    style: { width: 240 },
    data: {
      label: "player",
      pos: { x: 120, y: 320 },
      color: "red",
      collision: true,
      tags: ["player", "tiled-template:player"],
    },
  },
  {
    id: "inputModifier-tp",
    type: "inputModifier",
    parentId: "actor-1",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: { controls: "wasd" },
  },
  {
    id: "platformerMovementModifier-tp",
    type: "platformerMovementModifier",
    parentId: "actor-1",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: { maxSpeed: 220, accel: 1800, friction: 1600, airControl: 0.7 },
  },
  {
    id: "gravityModifier-tp",
    type: "gravityModifier",
    parentId: "actor-1",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: { gravity: 1400, maxFallSpeed: 900, enabled: true },
  },
  {
    id: "groundModifier-tp",
    type: "groundModifier",
    parentId: "actor-1",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: { solidTags: ["solid", "one-way-platform"], emitTag: "player" },
  },
  {
    id: "jumpModifier-tp",
    type: "jumpModifier",
    parentId: "actor-1",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: {
      jumpVelocity: 520,
      variableHeightCutoff: 180,
      coyoteMs: 100,
      bufferMs: 120,
      maxJumps: 1,
      emitTag: "player",
    },
  },
  {
    id: "cameraFollowModifier-tp",
    type: "cameraFollowModifier",
    parentId: "actor-1",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: {
      followX: true,
      followY: false,
      deadW: 80,
      deadH: 40,
      lerp: 0.15,
      offsetX: 0,
      offsetY: 0,
    },
  },
  {
    id: "spriteModifier-tp",
    type: "spriteModifier",
    parentId: "actor-1",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: {
      imageNodeId: "image-player",
      spritesheetNodeId: "spritesheet-player",
      frameIndex: 0,
    },
  },
  {
    id: "animationModifier-tp",
    type: "animationModifier",
    parentId: "actor-1",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: {
      // Combat states (attack / hurt / death) are pinned by AttackModifier
      // and HitboxSystem; idle/run/jump/fall are auto-selected by motion.
      // Frame ranges below are educated guesses for knight.png — open the
      // Animation node's debug strip to dial them in for your sheet.
      states: {
        idle: "animation-idle",
        run: "animation-run",
        jump: "animation-jump",
        fall: "animation-fall",
        attack: "animation-knight-attack",
        hurt: "animation-knight-hurt",
        death: "animation-knight-death",
      },
      flipOnDirection: true,
    },
  },
  {
    id: "hurtboxModifier-tp",
    type: "hurtboxModifier",
    parentId: "actor-1",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: {
      shapes: [{ x: -8, y: -10, w: 16, h: 20 }],
      tags: ["player"],
      iFrameMs: 500,
    },
  },
  {
    id: "healthModifier-tp",
    type: "healthModifier",
    parentId: "actor-1",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: { max: 5, onZero: "kill", emitEvent: "" },
  },
  {
    id: "attackModifier-tp",
    type: "attackModifier",
    parentId: "actor-1",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: {
      attackKey: "KeyX",
      durationMs: 250,
      damage: 1,
      reach: 20,
      boxHeight: 16,
      targetTags: ["enemy"],
      emitEvent: "player-attacked",
    },
  },
  {
    id: "soundModifier-tp-jump",
    type: "soundModifier",
    parentId: "actor-1",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: {
      soundNodeId: "sound-jump",
      eventName: "player-jumped",
      volume: 0.6,
    },
  },
  {
    id: "soundModifier-tp-land",
    type: "soundModifier",
    parentId: "actor-1",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: {
      soundNodeId: "sound-land",
      eventName: "player-grounded",
      volume: 0.4,
    },
  },
  // Coin pickup: three collision rules on the player. When the player
  // touches anything tagged "coin", play the pickup SFX, remove the coin,
  // and emit "coin-collected" so the Counter node increments.
  {
    id: "collisionRuleModifier-coin-sound",
    type: "collisionRuleModifier",
    parentId: "actor-1",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: {
      target: "coin",
      action: "playSound",
      playSoundKey: "sound-coin",
      playSoundVolume: 0.7,
    },
  },
  {
    id: "collisionRuleModifier-coin-remove",
    type: "collisionRuleModifier",
    parentId: "actor-1",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: { target: "coin", action: "removeOther" },
  },
  {
    id: "collisionRuleModifier-coin-event",
    type: "collisionRuleModifier",
    parentId: "actor-1",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: {
      target: "coin",
      action: "emitEvent",
      emitEventName: "coin-collected",
    },
  },
  // Fallback floor so the player doesn't drop forever before the map is set.
  // groupY=420 places the floor's top edge at y=400; camera at (320, 240)
  // with viewport 640x360 shows y∈[60, 420], so the floor + a player resting
  // on it remain visible. (Don't drop the floor lower without also enabling
  // followY on the camera modifier.)
  {
    id: "graphicGroup-floor-tp",
    type: "graphicGroup",
    position: { x: 320, y: 40 },
    data: {
      label: "Fallback Floor",
      groupX: 800,
      groupY: 420,
      collision: true,
      physicsType: "fixed",
      invisible: false,
      tags: ["solid"],
      shapes: [
        {
          id: "floor-rect-tp",
          kind: "rect",
          x: 0,
          y: 0,
          w: 1600,
          h: 40,
          color: "gray",
        },
      ],
    },
  },
  // Asset nodes ---------------------------------------------------------
  {
    id: "image-player",
    type: "image",
    position: { x: 320, y: 360 },
    data: { label: "Player Image", src: "/sprites/knight.png" },
  },
  {
    id: "spritesheet-player",
    type: "spritesheet",
    position: { x: 600, y: 360 },
    // knight.png is 256×256. The actual character cells are 24×24 with a
    // 4-px outer margin and 8 px of spacing between cells — these settings
    // line up the numbered preview with each character pose.
    data: {
      label: "Player Sheet",
      columns: 16,
      rows: 16,
      frameWidth: 24,
      frameHeight: 24,
      margin: 4,
      spacing: 8,
    },
  },
  {
    id: "animation-idle",
    type: "animation",
    position: { x: 880, y: 40 },
    data: {
      label: "Idle",
      frames: [0, 1, 2, 3],
      frameDurationMs: 200,
      strategy: "loop",
    },
  },
  {
    id: "animation-run",
    type: "animation",
    position: { x: 880, y: 280 },
    data: {
      label: "Run",
      frames: [32, 33, 34, 35],
      frameDurationMs: 100,
      strategy: "loop",
    },
  },
  {
    id: "animation-jump",
    type: "animation",
    position: { x: 880, y: 520 },
    data: {
      label: "Jump",
      frames: [0,1,2,3],
      frameDurationMs: 1000,
      strategy: "freeze",
    },
  },
  {
    id: "animation-fall",
    type: "animation",
    position: { x: 880, y: 760 },
    data: {
      label: "Fall",
      frames: [0,1,2,3],
      frameDurationMs: 1000,
      strategy: "freeze",
    },
  },
  // Knight combat animations — exact frame ranges depend on knight.png's
  // layout; open each Animation node's `debug` toggle to confirm and tweak.
  {
    id: "animation-knight-attack",
    type: "animation",
    position: { x: 880, y: 1480 },
    data: {
      label: "Knight Attack",
      frames: [80, 81, 82, 83, 84, 85, 86, 87],
      frameDurationMs: 50,
      strategy: "freeze",
    },
  },
  {
    id: "animation-knight-hurt",
    type: "animation",
    position: { x: 880, y: 1720 },
    data: {
      label: "Knight Hurt",
      frames: [96, 97],
      frameDurationMs: 100,
      strategy: "freeze",
    },
  },
  {
    id: "animation-knight-death",
    type: "animation",
    position: { x: 880, y: 1960 },
    data: {
      label: "Knight Death",
      frames: [112, 113, 114, 115],
      frameDurationMs: 120,
      strategy: "freeze",
    },
  },
  // Slime enemy asset chain. slime_green.png is 96×72 → 4 cols × 3 rows
  // of 24×24 frames. Row 0 = idle, row 1 = move, row 2 = die (common
  // slime layout — adjust frames if your sheet differs).
  {
    id: "image-slime",
    type: "image",
    position: { x: 320, y: 1480 },
    data: { label: "Slime Image", src: "/sprites/slime_green.png" },
  },
  {
    id: "spritesheet-slime",
    type: "spritesheet",
    position: { x: 600, y: 1080 },
    data: {
      label: "Slime Sheet",
      columns: 4,
      rows: 3,
      frameWidth: 24,
      frameHeight: 24,
      margin: 0,
      spacing: 0,
    },
  },
  {
    id: "animation-slime-idle",
    type: "animation",
    position: { x: 880, y: 2200 },
    data: {
      label: "Slime Idle",
      frames: [0, 1, 2, 3],
      frameDurationMs: 180,
      strategy: "loop",
    },
  },
  {
    id: "animation-slime-death",
    type: "animation",
    position: { x: 880, y: 2440 },
    data: {
      label: "Slime Death",
      frames: [8, 9, 10, 11],
      frameDurationMs: 120,
      strategy: "freeze",
    },
  },
  // The slime enemy itself — three instances perched on the platforms.
  {
    id: "actor-slime",
    type: "actor",
    position: { x: 40, y: 1900 },
    style: { width: 240 },
    data: {
      label: "slime",
      pos: { x: 232, y: 312 },
      color: "green",
      collision: true,
      // `tiled-template:slime` lets scene.tsx project every .tmj object
      // with class="slime" into this actor's `instances`. The default
      // instances below are a fallback for when no Tiled map is wired.
      tags: ["enemy", "tiled-template:slime"],
      instances: [
        { id: "s1", x: 232, y: 312 },
        { id: "s2", x: 152, y: 280 },
        { id: "s3", x: 360, y: 312 },
      ],
    },
  },
  {
    id: "animationModifier-slime",
    type: "animationModifier",
    parentId: "actor-slime",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: {
      states: {
        idle: "animation-slime-idle",
        run: "animation-slime-idle",
        jump: "animation-slime-idle",
        fall: "animation-slime-idle",
        hurt: "animation-slime-idle",
        death: "animation-slime-death",
      },
      flipOnDirection: false,
    },
  },
  {
    id: "hurtboxModifier-slime",
    type: "hurtboxModifier",
    parentId: "actor-slime",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: {
      shapes: [{ x: -10, y: -8, w: 20, h: 16 }],
      tags: ["enemy"],
      iFrameMs: 300,
    },
  },
  {
    id: "healthModifier-slime",
    type: "healthModifier",
    parentId: "actor-slime",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: { max: 2, onZero: "kill", emitEvent: "" },
  },
  {
    id: "hitboxModifier-slime",
    type: "hitboxModifier",
    parentId: "actor-slime",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: {
      shapes: [{ x: -10, y: -8, w: 20, h: 16 }],
      damage: 1,
      targetTags: ["player"],
      active: true,
    },
  },
  {
    id: "gravityModifier-slime",
    type: "gravityModifier",
    parentId: "actor-slime",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: { gravity: 1400, maxFallSpeed: 600, enabled: true },
  },
  {
    id: "groundModifier-slime",
    type: "groundModifier",
    parentId: "actor-slime",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: { solidTags: ["solid", "one-way-platform"], emitTag: "" },
  },
  {
    id: "patrolModifier-slime",
    type: "patrolModifier",
    parentId: "actor-slime",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: {
      speed: 30,
      range: 32,
      startDirection: "right",
      pauseAtTurnMs: 250,
    },
  },
  {
    id: "sound-jump",
    type: "sound",
    position: { x: 320, y: 640 },
    data: {
      label: "Jump SFX",
      src: "/sounds/jump.wav",
      volume: 0.6,
      loop: false,
    },
  },
  {
    id: "sound-land",
    type: "sound",
    position: { x: 320, y: 880 },
    data: {
      label: "Land SFX",
      src: "/sounds/tap.wav",
      volume: 0.4,
      loop: false,
    },
  },
  // Coin assets ----------------------------------------------------------
  {
    id: "image-coin",
    type: "image",
    position: { x: 320, y: 1120 },
    data: { label: "Coin Image", src: "/sprites/coin.png" },
  },
  {
    id: "spritesheet-coin",
    type: "spritesheet",
    position: { x: 600, y: 720 },
    data: {
      label: "Coin Sheet",
      columns: 12,
      rows: 1,
      frameWidth: 16,
      frameHeight: 16,
      margin: 0,
      spacing: 0,
    },
  },
  {
    id: "animation-coin-spin",
    type: "animation",
    position: { x: 880, y: 1240 },
    data: {
      label: "Coin Spin",
      frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      frameDurationMs: 80,
      strategy: "loop",
      originX: 0,
      originY: 0,
    },
  },
  {
    id: "sound-coin",
    type: "sound",
    position: { x: 320, y: 1320 },
    data: {
      label: "Coin SFX",
      src: "/sounds/coin.wav",
      volume: 0.7,
      loop: false,
    },
  },
  // One coin Actor that acts as a template: three instances are spawned
  // at the per-instance positions, all sharing the same color/tag/collision
  // and the same coin-spin animation. Instances hover above the three
  // platforms in level-1.tmj (map rows 4 / 6 / 8 with posY=200 → platform
  // tops at world-y 264 / 296 / 328; coins sit ~8 px above each).
  {
    id: "actor-coin",
    type: "actor",
    position: { x: 40, y: 1200 },
    style: { width: 240 },
    data: {
      label: "coin",
      pos: { x: 88, y: 320 },
      color: "yellow",
      collision: true,
      tags: ["coin"],
      instances: [
        { id: "c1", x: 88, y: 320 },
        { id: "c2", x: 152, y: 288 },
        { id: "c3", x: 224, y: 256 },
      ],
    },
  },
  {
    id: "animationModifier-coin",
    type: "animationModifier",
    parentId: "actor-coin",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: {
      states: {
        idle: "animation-coin-spin",
        run: "animation-coin-spin",
        jump: "animation-coin-spin",
        fall: "animation-coin-spin",
      },
    },
  },
  // Counter overlay — listens for "coin-collected" emitted by the player's
  // collision rule and renders a count in the top-left of the canvas.
  {
    id: "counter-coins",
    type: "counter",
    position: { x: 1480, y: 480 },
    data: {
      label: "Coins",
      eventName: "coin-collected",
      resetEventName: "",
      anchor: "top-left",
      color: "#ffd700",
    },
  },
  {
    id: "tiledMap-level1",
    type: "tiledMap",
    position: { x: 880, y: 1000 },
    // Map is 20×12 tiles of 16 px → 320×192 px. With posY=200 the bottom of
    // the map sits at world-y=392 (just above the fallback floor at y=400),
    // so the map fills the lower half of the camera's view (60→420).
    data: {
      label: "Level 1 Map",
      src: "/maps/level-1.tmj",
      spawnObjects: true,
      posX: 0,
      posY: 200,
    },
  },
];

export const tiledPlatformerEdges = [
  { id: "e-tp-img-sheet", source: "image-player", target: "spritesheet-player" },
  {
    id: "e-tp-sheet-idle",
    source: "spritesheet-player",
    target: "animation-idle",
  },
  {
    id: "e-tp-sheet-run",
    source: "spritesheet-player",
    target: "animation-run",
  },
  {
    id: "e-tp-sheet-jump",
    source: "spritesheet-player",
    target: "animation-jump",
  },
  {
    id: "e-tp-sheet-fall",
    source: "spritesheet-player",
    target: "animation-fall",
  },
  { id: "e-tp-a1-s1", source: "actor-1", target: "scene-1" },
  { id: "e-tp-floor-s1", source: "graphicGroup-floor-tp", target: "scene-1" },
  { id: "e-tp-tiled-s1", source: "tiledMap-level1", target: "scene-1" },
  { id: "e-tp-s1-g1", source: "scene-1", target: "game-1" },
  // Coin asset chain.
  { id: "e-tp-coin-img-sheet", source: "image-coin", target: "spritesheet-coin" },
  {
    id: "e-tp-coin-sheet-anim",
    source: "spritesheet-coin",
    target: "animation-coin-spin",
  },
  // Coin template Actor (3 instances) lives in scene-1.
  { id: "e-tp-coin-s1", source: "actor-coin", target: "scene-1" },
  // Knight combat animation chain (already share spritesheet-player).
  {
    id: "e-tp-sheet-attack",
    source: "spritesheet-player",
    target: "animation-knight-attack",
  },
  {
    id: "e-tp-sheet-hurt",
    source: "spritesheet-player",
    target: "animation-knight-hurt",
  },
  {
    id: "e-tp-sheet-death",
    source: "spritesheet-player",
    target: "animation-knight-death",
  },
  // Slime asset chain.
  { id: "e-tp-slime-img-sheet", source: "image-slime", target: "spritesheet-slime" },
  {
    id: "e-tp-slime-sheet-idle",
    source: "spritesheet-slime",
    target: "animation-slime-idle",
  },
  {
    id: "e-tp-slime-sheet-death",
    source: "spritesheet-slime",
    target: "animation-slime-death",
  },
  // Slime enemy template (3 instances) lives in scene-1.
  { id: "e-tp-slime-s1", source: "actor-slime", target: "scene-1" },
  // Counter overlay attaches to the Game node.
  { id: "e-tp-counter-g1", source: "counter-coins", target: "game-1" },
];
