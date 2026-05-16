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
    position: { x: 2740, y: 40 },
    data: { label: "Game", width: 640, height: 360 },
  },
  {
    id: "scene-1",
    type: "scene",
    position: { x: 2400, y: 40 },
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
    // Player actor has ~19 modifiers, so this card is ~800px tall.
    // Next actor (slime) starts at y=900 below.
    style: { width: 240 },
    data: {
      label: "player",
      pos: { x: 120, y: 320 },
      color: "red",
      collision: true,
      tags: ["player"],
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
    // `onZero: "emit"` instead of "kill" so the sceneSwitch-die modifier
    // catches "player-died" and goes to the Game Over scene; the death
    // animation pinning still runs because HitboxSystem pins it before
    // dispatching the on-zero action.
    data: { max: 5, onZero: "emit", emitEvent: "player-died" },
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
    position: { x: 340, y: 40 },
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
    position: { x: 640, y: 40 },
    data: { label: "Player Image", src: "/sprites/knight.png" },
  },
  {
    id: "spritesheet-player",
    type: "spritesheet",
    position: { x: 940, y: 40 },
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
    position: { x: 1500, y: 40 },
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
    position: { x: 1500, y: 200 },
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
    position: { x: 1500, y: 360 },
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
    position: { x: 1500, y: 520 },
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
    position: { x: 1500, y: 680 },
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
    position: { x: 1500, y: 840 },
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
    position: { x: 1500, y: 1000 },
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
    position: { x: 640, y: 340 },
    data: { label: "Slime Image", src: "/sprites/slime_green.png" },
  },
  {
    id: "spritesheet-slime",
    type: "spritesheet",
    position: { x: 940, y: 600 },
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
    position: { x: 1500, y: 1200 },
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
    position: { x: 1500, y: 1360 },
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
    position: { x: 40, y: 900 },
    style: { width: 240 },
    data: {
      label: "slime",
      pos: { x: 232, y: 312 },
      color: "green",
      collision: true,
      // scene.tsx matches Tiled object `class` directly against tags, so
      // every .tmj object with class="slime" populates this actor's
      // `instances`. The defaults below are a fallback when no Tiled map
      // is wired.
      tags: ["enemy", "slime"],
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
    position: { x: 1800, y: 40 },
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
    position: { x: 1800, y: 240 },
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
    position: { x: 640, y: 640 },
    data: { label: "Coin Image", src: "/sprites/coin.png" },
  },
  {
    id: "spritesheet-coin",
    type: "spritesheet",
    position: { x: 940, y: 920 },
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
    position: { x: 1500, y: 1520 },
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
    position: { x: 1800, y: 440 },
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
    position: { x: 40, y: 1300 },
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
    position: { x: 340, y: 260 },
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
    position: { x: 2040, y: 40 },
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
  // --- World tileset (shared with Tiled maps; also used for the door sprite). ---
  {
    id: "image-world",
    type: "image",
    position: { x: 640, y: 940 },
    data: { label: "World Tileset", src: "/sprites/world_tileset.png" },
  },
  {
    id: "spritesheet-world",
    type: "spritesheet",
    position: { x: 940, y: 1200 },
    data: {
      label: "World Sheet",
      columns: 16,
      rows: 16,
      frameWidth: 16,
      frameHeight: 16,
      margin: 0,
      spacing: 0,
    },
  },
  {
    id: "animation-sign",
    type: "animation",
    position: { x: 1500, y: 1680 },
    // Frame 29 = row 1, col 13 of the world tileset — a wooden sign sprite.
    // User can tweak in the node UI if a different tile reads better.
    data: {
      label: "Sign",
      frames: [56],
      frameDurationMs: 1000,
      loop: false,
    },
  },
  // --- Door actor: a static sign at the end of level 1 that switches scenes. ---
  // Tagged "door" so scene.tsx's class-to-tag projection picks up the .tmj
  // object of class="door" and turns this Actor into one instance per
  // door. The collision rule fires switchScene when the player touches it.
  {
    id: "actor-door",
    type: "actor",
    position: { x: 40, y: 1500 },
    style: { width: 240 },
    data: {
      label: "door",
      pos: { x: 472, y: 360 },
      color: "yellow",
      collision: true,
      tags: ["door"],
      instances: [],
    },
  },
  {
    id: "animationModifier-door",
    type: "animationModifier",
    parentId: "actor-door",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: {
      states: {
        idle: "animation-sign",
        run: "animation-sign",
        jump: "animation-sign",
        fall: "animation-sign",
      },
      flipOnDirection: false,
    },
  },
  // Player → door collision: switch to scene-2.
  {
    id: "collisionRuleModifier-door",
    type: "collisionRuleModifier",
    parentId: "actor-1",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: {
      target: "door",
      action: "switchScene",
      targetSceneId: "scene-2",
      sceneSpawnX: 56,
      sceneSpawnY: 360,
    },
  },
  // --- Scene 2 + its Tiled map. ---
  {
    id: "scene-2",
    type: "scene",
    position: { x: 2400, y: 400 },
    // Same camera defaults as scene-1 (1× zoom, centred on the map area)
    // so the level renders at the same scale; the CameraFollow modifier
    // on the player takes over once the player is added to this scene.
    data: {
      label: "Level 2",
      backgroundColor: "#a8d8ea",
      cameraX: 320,
      cameraY: 240,
      cameraZoom: 1,
      showGrid: false,
    },
  },
  {
    id: "tiledMap-level2",
    type: "tiledMap",
    position: { x: 2040, y: 600 },
    data: {
      label: "Level 2 Map",
      src: "/maps/level-2.tmj",
      spawnObjects: true,
      posX: 0,
      posY: 200,
    },
  },
  // --- Game Over scene + restart wiring. ---
  // Player's HealthComponent emits "player-died" on zero HP (see the
  // healthModifier-tp update below). sceneSwitchModifier-die catches it
  // and goes here. The restart modifier listens for KeyR but only fires
  // when we're already on the Game Over scene.
  {
    id: "scene-game-over",
    type: "scene",
    position: { x: 2400, y: 760 },
    data: {
      label: "Game Over",
      backgroundColor: "#1a1a26",
      // Same viewport as the other scenes so the placeholder graphic
      // group renders at the expected scale.
      cameraX: 320,
      cameraY: 240,
      cameraZoom: 1,
      showGrid: false,
    },
  },
  // The Game Over screen is built from two entities so the user can drop
  // / restyle them independently in the editor:
  //   * `graphicGroup-gameover` — static "GAME OVER" title text + backdrop.
  //   * `graphicGroup-restart-btn` — visual frame for the button.
  //   * `actor-restart-btn` — the clickable hitbox. Tagged "restart-button"
  //      with a ClickModifier that emits "restart-clicked", which the
  //      sceneSwitchModifier-restart catches.
  {
    id: "graphicGroup-gameover",
    type: "graphicGroup",
    position: { x: 340, y: 440 },
    data: {
      label: "Game Over Text",
      groupX: 320,
      groupY: 170,
      collision: false,
      physicsType: "passive",
      invisible: false,
      tags: [],
      shapes: [
        {
          id: "go-bg",
          kind: "rect",
          x: 0,
          y: 0,
          w: 360,
          h: 110,
          color: "black",
        },
        {
          id: "go-title",
          kind: "text",
          x: -110,
          y: -28,
          text: "GAME OVER",
          size: 36,
          color: "red",
        },
      ],
    },
  },
  {
    id: "actor-restart-btn",
    type: "actor",
    position: { x: 40, y: 1750 },
    style: { width: 240 },
    data: {
      label: "Restart Button",
      pos: { x: 320, y: 260 },
      // Click hitbox matches the visual rect on the graphic group below.
      width: 200,
      height: 56,
      // `collision: true` keeps the body Active so pointer-down hit
      // testing finds the collider. `invisible: true` hides the actor's
      // default yellow rect so the sibling graphic group is the only
      // visible button surface.
      color: "yellow",
      collision: true,
      invisible: true,
      tags: ["restart-button"],
      instances: [],
    },
  },
  {
    id: "graphicGroup-restart-btn-visual",
    type: "graphicGroup",
    position: { x: 340, y: 700 },
    data: {
      label: "Restart Button Skin",
      groupX: 320,
      groupY: 260,
      collision: false,
      physicsType: "passive",
      invisible: false,
      tags: [],
      shapes: [
        {
          id: "rb-bg",
          kind: "rect",
          x: 0,
          y: 0,
          w: 200,
          h: 56,
          color: "white",
        },
        {
          id: "rb-label",
          kind: "text",
          x: -56,
          y: -12,
          text: "RESTART",
          size: 22,
          color: "black",
        },
      ],
    },
  },
  {
    id: "clickModifier-restart-btn",
    type: "clickModifier",
    parentId: "actor-restart-btn",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: {
      eventName: "restart-clicked",
      hoverCursor: true,
    },
  },
  {
    id: "sceneSwitchModifier-die",
    type: "sceneSwitchModifier",
    parentId: "actor-1",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
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
    parentId: "actor-1",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: {
      eventName: "restart-clicked",
      keyCode: "",
      targetSceneId: "scene-1",
      // Only fires while game-over is the active scene so a stray click
      // mid-game can't accidentally restart.
      onlyInScene: "scene-game-over",
      alsoReset: true,
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
  // World tileset chain — feeds the sign-frame Animation used by the Door.
  { id: "e-tp-world-img-sheet", source: "image-world", target: "spritesheet-world" },
  {
    id: "e-tp-world-sheet-sign",
    source: "spritesheet-world",
    target: "animation-sign",
  },
  // Door Actor lives in scene-1 (the .tmj projects every class="door"
  // object as an instance there). When the user crosses the door, the
  // player's collisionRuleModifier-door fires switchScene → scene-2.
  { id: "e-tp-door-s1", source: "actor-door", target: "scene-1" },
  // Level 2 wiring — the same Actors (player, slime, coin, door) live
  // in this scene too because the .tmj also has class="player",
  // class="slime", class="coin", class="door" objects. The class →
  // tag matcher means we don't need separate Actor nodes per level.
  { id: "e-tp-tiled-s2", source: "tiledMap-level2", target: "scene-2" },
  { id: "e-tp-a1-s2", source: "actor-1", target: "scene-2" },
  { id: "e-tp-coin-s2", source: "actor-coin", target: "scene-2" },
  { id: "e-tp-slime-s2", source: "actor-slime", target: "scene-2" },
  { id: "e-tp-door-s2", source: "actor-door", target: "scene-2" },
  { id: "e-tp-s2-g1", source: "scene-2", target: "game-1" },
  // Game Over scene: title text + clickable Restart button entity.
  { id: "e-tp-go-graphics", source: "graphicGroup-gameover", target: "scene-game-over" },
  { id: "e-tp-go-btn-visual", source: "graphicGroup-restart-btn-visual", target: "scene-game-over" },
  { id: "e-tp-go-btn-actor", source: "actor-restart-btn", target: "scene-game-over" },
  { id: "e-tp-go-g1", source: "scene-game-over", target: "game-1" },
];
