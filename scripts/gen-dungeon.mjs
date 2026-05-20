// Throwaway author tool: emits the two top-down dungeon Tiled maps used by
// the "dungeon" template. Run once from the repo root:
//
//   node scripts/gen-dungeon.mjs
//
// It writes public/maps/dungeon-1.tmj and dungeon-2.tmj. Hand-writing ~600
// tile ints per layer is error-prone, so we build them programmatically.
//
// Tilesets (16px tiles, see plan):
//   - relief (firstgid 1)   -> TilesetRelief.png  (20 cols, 240 tiles) = WALLS
//   - floor  (firstgid 241) -> TilesetFloor.png   (22 cols, 572 tiles) = FLOOR
// Verified opaque picks: FLOOR_GID 264 (tan floor), WALL_GID 146 (brown wall).

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "maps");

const W = 30;
const H = 20;
const TILE = 16;
const FLOOR_GID = 264;
const WALL_GID = 146;
const RELIEF_FIRSTGID = 1;
const FLOOR_FIRSTGID = 241;

const tilesets = () => [
  {
    firstgid: RELIEF_FIRSTGID,
    name: "relief",
    image: "../adventure/Backgrounds/Tilesets/TilesetRelief.png",
    imagewidth: 320,
    imageheight: 192,
    columns: 20,
    tilecount: 240,
    tilewidth: TILE,
    tileheight: TILE,
    margin: 0,
    spacing: 0,
  },
  {
    firstgid: FLOOR_FIRSTGID,
    name: "floor",
    image: "../adventure/Backgrounds/Tilesets/TilesetFloor.png",
    imagewidth: 352,
    imageheight: 417,
    columns: 22,
    tilecount: 572,
    tilewidth: TILE,
    tileheight: TILE,
    margin: 0,
    spacing: 0,
  },
];

// floor layer: full fill.
function floorData() {
  return new Array(W * H).fill(FLOOR_GID);
}

// walls layer: border ring + caller-supplied interior obstacle cells.
function wallData(obstacles) {
  const d = new Array(W * H).fill(0);
  const set = (c, r) => {
    if (c < 0 || c >= W || r < 0 || r >= H) return;
    d[r * W + c] = WALL_GID;
  };
  for (let c = 0; c < W; c++) {
    set(c, 0);
    set(c, H - 1);
  }
  for (let r = 0; r < H; r++) {
    set(0, r);
    set(W - 1, r);
  }
  // Obstacles: each is [col, row, w, h] filled rectangle.
  for (const [c, r, w, h] of obstacles) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) set(c + x, r + y);
  }
  return d;
}

function obj(id, type, name, col, row) {
  return {
    id,
    name,
    type,
    x: col * TILE,
    y: row * TILE,
    width: TILE,
    height: TILE,
    rotation: 0,
    visible: true,
    opacity: 1,
  };
}

function buildMap({ obstacles, objects }) {
  return {
    compressionlevel: -1,
    width: W,
    height: H,
    infinite: false,
    orientation: "orthogonal",
    renderorder: "right-down",
    tiledversion: "1.12.1",
    version: "1.10",
    type: "map",
    tilewidth: TILE,
    tileheight: TILE,
    nextlayerid: 4,
    nextobjectid: objects.length + 1,
    tilesets: tilesets(),
    layers: [
      {
        id: 1,
        name: "floor",
        type: "tilelayer",
        width: W,
        height: H,
        x: 0,
        y: 0,
        opacity: 1,
        visible: true,
        data: floorData(),
      },
      {
        id: 2,
        name: "walls",
        type: "tilelayer",
        width: W,
        height: H,
        x: 0,
        y: 0,
        opacity: 1,
        visible: true,
        properties: [{ name: "solid", type: "bool", value: true }],
        data: wallData(obstacles),
      },
      {
        id: 3,
        name: "objects",
        type: "objectgroup",
        draworder: "topdown",
        x: 0,
        y: 0,
        opacity: 1,
        visible: true,
        objects,
      },
    ],
  };
}

// --- Level 1: enter top-left, stairs (-> scene-2) bottom-right. ---
const level1 = buildMap({
  obstacles: [
    [8, 8, 2, 2],
    [20, 5, 2, 2],
    [14, 12, 3, 1],
    [24, 14, 1, 3],
  ],
  objects: [
    obj(1, "player", "player-spawn", 2, 2),
    obj(2, "skeleton", "skeleton-1", 20, 4),
    obj(3, "skeleton", "skeleton-2", 10, 15),
    obj(4, "slime", "slime-1", 24, 10),
    obj(5, "slime", "slime-2", 6, 9),
    obj(6, "stairs", "stairs-down", 27, 17),
  ],
});

// --- Level 2: enter bottom-left, stairs-back (-> scene-1) top-right. ---
const level2 = buildMap({
  obstacles: [
    [6, 5, 3, 1],
    [12, 9, 2, 3],
    [18, 6, 1, 4],
    [22, 13, 3, 2],
  ],
  objects: [
    obj(1, "player", "player-spawn", 2, 17),
    obj(2, "skeleton", "skeleton-1", 8, 4),
    obj(3, "skeleton", "skeleton-2", 25, 6),
    obj(4, "slime", "slime-1", 14, 5),
    obj(5, "slime", "slime-2", 20, 16),
    obj(6, "slime", "slime-3", 5, 11),
    obj(7, "stairs-back", "stairs-up", 27, 2),
  ],
});

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "dungeon-1.tmj"), JSON.stringify(level1, null, 1));
writeFileSync(join(OUT_DIR, "dungeon-2.tmj"), JSON.stringify(level2, null, 1));
console.log("wrote dungeon-1.tmj and dungeon-2.tmj to", OUT_DIR);
