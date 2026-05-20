import {
  Actor,
  Animation,
  CollisionGroup,
  CollisionGroupManager,
  ImageSource,
  Sound,
  SpriteSheet,
  Vector,
  vec,
} from "excalibur";
import { useEffect, useState } from "preact/hooks";
import { useGame } from "../../App";

export function parseTags(input: string): string[] {
  return input
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function tagsToString(tags: string[] | undefined): string {
  return (tags ?? []).join(", ");
}

export function applyTags(actor: Actor, tags: string[]) {
  for (const t of Array.from(actor.tags)) {
    if (!tags.includes(t)) actor.removeTag(t);
  }
  for (const t of tags) {
    if (!actor.hasTag(t)) actor.addTag(t);
  }
}

// --- Follower position-history registry ---------------------------------
// Keyed by leader tag; each entry is the most-recent-first list of unique
// positions the leader has occupied. `delay=1` reads the most recent
// position; `delay=N` reads N steps back. Populated by LeaderHistorySystem.

const HISTORY_LIMIT = 200;
const positionHistory = new Map<string, Vector[]>();

function isSamePos(a: Vector | undefined, b: Vector): boolean {
  return !!a && a.x === b.x && a.y === b.y;
}

export function recordLeaderPos(leaderTag: string, pos: Vector) {
  const buf = positionHistory.get(leaderTag) ?? [];
  if (isSamePos(buf[0], pos)) return;
  buf.unshift(vec(pos.x, pos.y));
  if (buf.length > HISTORY_LIMIT) buf.pop();
  positionHistory.set(leaderTag, buf);
}

export function getLeaderHistoryPos(
  leaderTag: string,
  delay: number,
): Vector | undefined {
  return positionHistory.get(leaderTag)?.[Math.max(0, delay)];
}

// Best-effort historical position: returns history[delay] if available,
// otherwise the oldest known position. Used to spawn new followers at a
// sensible "trailing" spot rather than directly on top of the leader.
export function getLeaderHistoryPosOrOldest(
  leaderTag: string,
  delay: number,
): Vector | undefined {
  const buf = positionHistory.get(leaderTag);
  if (!buf || buf.length === 0) return undefined;
  return buf[Math.min(delay, buf.length - 1)];
}

export function clearAllLeaderHistories() {
  positionHistory.clear();
}

// --- Spawner registry ---------------------------------------------------
// Spawners register themselves by tag via SpawnerComponent; collision rules
// fire them by tag via CollisionRulesComponent.

const spawners = new Map<string, () => void>();

export function registerSpawner(tag: string, spawn: () => void) {
  spawners.set(tag, spawn);
}

export function unregisterSpawner(tag: string) {
  spawners.delete(tag);
}

export function callSpawner(tag: string): boolean {
  const fn = spawners.get(tag);
  if (!fn) return false;
  fn();
  return true;
}

// --- Tail grower registry -----------------------------------------------
// Tails register a grow callback keyed by their leader tag via
// TailGrowerComponent, so collision rules can bump the session length
// without mutating the node's stored `length` field.

const tailGrowers = new Map<string, (delta: number) => void>();

export function registerTailGrower(
  tag: string,
  grow: (delta: number) => void,
) {
  tailGrowers.set(tag, grow);
}

export function unregisterTailGrower(tag: string) {
  tailGrowers.delete(tag);
}

export function callTailGrower(tag: string, delta: number = 1): boolean {
  const fn = tailGrowers.get(tag);
  if (!fn) return false;
  fn(delta);
  return true;
}

export function findEntityByTag(
  entities: Record<string, any>,
  tag: string,
): Actor | undefined {
  for (const e of Object.values(entities)) {
    if (e && typeof e.hasTag === "function" && e.hasTag(tag))
      return e as Actor;
  }
  return undefined;
}

export function useParentActor(
  parentId: string | undefined,
): Actor | undefined {
  const game = useGame();
  if (!parentId) return undefined;
  return game.entities[parentId] as Actor | undefined;
}

// Returns every Excalibur Actor associated with the parent React Flow
// node id. For a single-pos Actor this is just `[primary]`. For a
// templated Actor (with instances) this is the deduped set of every
// instance actor under keys like `${parentId}__inst-...`.
export function useParentActors(parentId: string | undefined): Actor[] {
  const game = useGame();
  if (!parentId) return [];
  const seen = new Set<Actor>();
  const primary = game.entities[parentId];
  if (primary instanceof Actor) seen.add(primary);
  for (const key of Object.keys(game.entities)) {
    if (!key.startsWith(`${parentId}__inst-`)) continue;
    const e = game.entities[key];
    if (e instanceof Actor) seen.add(e);
  }
  return Array.from(seen);
}

export const SLOT_X = 4;
export const SLOT_GAP = 20;
export const ACTOR_WIDTH = 240;
export const SLOT_WIDTH = ACTOR_WIDTH - SLOT_X * 2;

// --- Collision groups -------------------------------------------------
// Actors tagged "enemy" don't physically push (or get pushed by) actors
// tagged "player" — the HitboxSystem's AABB checks are unaffected so
// damage still fires on overlap. Two-pass setup so we can exclude each
// other's category from the mask without needing mutable masks.
const ENEMY_GROUP = CollisionGroupManager.create("enemy");
const PLAYER_GROUP = CollisionGroupManager.create(
  "player",
  // Default mask is "everything" — strip out enemy.
  ~ENEMY_GROUP.category & 0xffffffff,
);
// Pickups (coins, hearts, …) should be visible to the player but
// invisible to enemies, so a patrolling slime walks right over a coin
// instead of bumping it. Same one-sided exclusion trick as PLAYER_GROUP.
const PICKUP_GROUP = CollisionGroupManager.create(
  "pickup",
  ~ENEMY_GROUP.category & 0xffffffff,
);

export function collisionGroupForTags(
  tags: string[] | undefined,
): CollisionGroup | undefined {
  if (!tags || tags.length === 0) return undefined;
  if (tags.includes("enemy")) return ENEMY_GROUP;
  if (tags.includes("player")) return PLAYER_GROUP;
  if (tags.includes("coin") || tags.includes("pickup")) return PICKUP_GROUP;
  return undefined;
}

// --- Event bus ----------------------------------------------------------
// Tiny typed pub/sub used by platformer systems (e.g. JumpSystem emits
// "player-jumped") and by OnEventModifier subscribers. Listeners are
// always cleaned up by the subscriber's React effect; clearAllEventListeners
// is a defensive sweep called from App.reset for unmount-order edge cases.

type EventPayload = Record<string, unknown>;
type EventListener = (payload: EventPayload) => void;
const eventListeners = new Map<string, Set<EventListener>>();

export function emit(event: string, payload: EventPayload = {}): void {
  const set = eventListeners.get(event);
  if (!set) return;
  // Snapshot — a listener may unsubscribe itself or another listener.
  for (const cb of Array.from(set)) {
    try {
      cb(payload);
    } catch (err) {
      console.error(`[eventBus] listener for "${event}" threw`, err);
    }
  }
}

export function on(event: string, cb: EventListener): () => void {
  let set = eventListeners.get(event);
  if (!set) {
    set = new Set();
    eventListeners.set(event, set);
  }
  set.add(cb);
  return () => {
    set!.delete(cb);
    if (set!.size === 0) eventListeners.delete(event);
  };
}

export function clearAllEventListeners(): void {
  eventListeners.clear();
}

// --- Asset registries ---------------------------------------------------
// Keyed by the React Flow node id of the asset node. Asset nodes register
// on mount (post-load) and unregister on unmount. Consumers (modifiers,
// collision rule actions) read by id. A monotonic `assetVersion` bumps on
// every register/unregister so React consumers can re-run their effects
// without polling — useful when a Spritesheet registers AFTER the Sprite
// modifier that consumes it has already mounted.

const imageSources = new Map<string, ImageSource>();
const spriteSheets = new Map<string, SpriteSheet>();
const animations = new Map<string, Animation>();
const sounds = new Map<string, Sound>();
// TiledResource lives in a peer plugin package; typed as unknown so this
// module compiles whether or not the plugin is installed yet.
const tiledMaps = new Map<string, unknown>();

let assetVersion = 0;
const assetVersionListeners = new Set<() => void>();

function bumpAssetVersion(): void {
  assetVersion++;
  for (const cb of Array.from(assetVersionListeners)) {
    try {
      cb();
    } catch {}
  }
}

export function useAssetVersion(): number {
  const [v, setV] = useState(assetVersion);
  useEffect(() => {
    const cb = () => setV(assetVersion);
    assetVersionListeners.add(cb);
    // Pick up any version bumps that happened between render and subscribe.
    if (v !== assetVersion) setV(assetVersion);
    return () => {
      assetVersionListeners.delete(cb);
    };
  }, []);
  return v;
}

// Hitbox/hurtbox debug overlay toggle. The HitboxDebugSystem (always
// registered, gated on this flag) draws hitboxes red, hurtboxes blue, and a
// spark wherever damage lands. The Game node header exposes the toggle.
let hitboxDebug = false;
const hitboxDebugListeners = new Set<() => void>();
export function getHitboxDebug(): boolean {
  return hitboxDebug;
}
export function setHitboxDebug(v: boolean): void {
  if (hitboxDebug === v) return;
  hitboxDebug = v;
  for (const cb of Array.from(hitboxDebugListeners)) {
    try {
      cb();
    } catch {}
  }
}
export function useHitboxDebug(): [boolean, (v: boolean) => void] {
  const [v, setV] = useState(hitboxDebug);
  useEffect(() => {
    const cb = () => setV(hitboxDebug);
    hitboxDebugListeners.add(cb);
    if (v !== hitboxDebug) setV(hitboxDebug);
    return () => {
      hitboxDebugListeners.delete(cb);
    };
  }, []);
  return [v, setHitboxDebug];
}

// Current state of the active State Machine node, published for the Game
// overlay and any state-gated behavior (e.g. a Build Menu that's only active
// in a given state). A single global "current state" is enough for the games
// we build; the State Machine node owns the transitions.
let currentState = "";
let currentStateHint = "";
const stateListeners = new Set<() => void>();
export function setCurrentState(name: string, hint = ""): void {
  if (currentState === name && currentStateHint === hint) return;
  currentState = name;
  currentStateHint = hint;
  for (const cb of Array.from(stateListeners)) {
    try {
      cb();
    } catch {}
  }
}
export function getCurrentState(): { name: string; hint: string } {
  return { name: currentState, hint: currentStateHint };
}
export function useCurrentState(): { name: string; hint: string } {
  const [v, setV] = useState({ name: currentState, hint: currentStateHint });
  useEffect(() => {
    const cb = () => setV({ name: currentState, hint: currentStateHint });
    stateListeners.add(cb);
    cb();
    return () => {
      stateListeners.delete(cb);
    };
  }, []);
  return v;
}

// Points / economy store — a spendable currency (distinct from a Counter,
// which only counts up). A Build Menu earns points (e.g. per kill) and spends
// them to place towers; the Game overlay can show the balance.
let points = 0;
const pointsListeners = new Set<() => void>();
function notifyPoints() {
  for (const cb of Array.from(pointsListeners)) {
    try {
      cb();
    } catch {}
  }
}
export function getPoints(): number {
  return points;
}
export function setPoints(n: number): void {
  if (points === n) return;
  points = n;
  notifyPoints();
}
export function addPoints(d: number): void {
  setPoints(points + d);
}
export function usePoints(): number {
  const [v, setV] = useState(points);
  useEffect(() => {
    const cb = () => setV(points);
    pointsListeners.add(cb);
    cb();
    return () => {
      pointsListeners.delete(cb);
    };
  }, []);
  return v;
}

// Whether the Game is in fullscreen "play" mode — published by the Game node
// so overlays rendered by other nodes (e.g. a Build Menu toolbar) can show
// only while playing.
let playModeOn = false;
const playModeListeners = new Set<() => void>();
export function setPlayModePublished(on: boolean): void {
  if (playModeOn === on) return;
  playModeOn = on;
  for (const cb of Array.from(playModeListeners)) {
    try {
      cb();
    } catch {}
  }
}
export function usePlayMode(): boolean {
  const [v, setV] = useState(playModeOn);
  useEffect(() => {
    const cb = () => setV(playModeOn);
    playModeListeners.add(cb);
    cb();
    return () => {
      playModeListeners.delete(cb);
    };
  }, []);
  return v;
}

// On-screen rectangle of the game canvas (in CSS pixels), published by the
// Game node every frame for both the editor preview and fullscreen play. HUD
// nodes (e.g. the Toolbar) anchor to it so they render *inside the game view*
// in either mode, instead of as a separate fullscreen-only overlay.
export type GameRect = { x: number; y: number; w: number; h: number };
let gameRect: GameRect | null = null;
const gameRectListeners = new Set<() => void>();
export function setGameRect(r: GameRect | null): void {
  const same =
    (!r && !gameRect) ||
    (!!r &&
      !!gameRect &&
      Math.round(r.x) === Math.round(gameRect.x) &&
      Math.round(r.y) === Math.round(gameRect.y) &&
      Math.round(r.w) === Math.round(gameRect.w) &&
      Math.round(r.h) === Math.round(gameRect.h));
  if (same) return;
  gameRect = r;
  for (const cb of Array.from(gameRectListeners)) {
    try {
      cb();
    } catch {}
  }
}
export function useGameRect(): GameRect | null {
  const [v, setV] = useState(gameRect);
  useEffect(() => {
    const cb = () => setV(gameRect);
    gameRectListeners.add(cb);
    cb();
    return () => {
      gameRectListeners.delete(cb);
    };
  }, []);
  return v;
}

// Wave progress text (e.g. "Wave 2/3") published by a Wave Spawner and shown
// as a HUD pill by the Game node.
let waveInfo = "";
const waveInfoListeners = new Set<() => void>();
export function setWaveInfo(s: string): void {
  if (waveInfo === s) return;
  waveInfo = s;
  for (const cb of Array.from(waveInfoListeners)) {
    try {
      cb();
    } catch {}
  }
}
export function useWaveInfo(): string {
  const [v, setV] = useState(waveInfo);
  useEffect(() => {
    const cb = () => setV(waveInfo);
    waveInfoListeners.add(cb);
    cb();
    return () => {
      waveInfoListeners.delete(cb);
    };
  }, []);
  return v;
}

export function registerImage(id: string, image: ImageSource): void {
  imageSources.set(id, image);
  bumpAssetVersion();
}
export function unregisterImage(id: string): void {
  if (imageSources.delete(id)) bumpAssetVersion();
}
export function getImage(id: string): ImageSource | undefined {
  return imageSources.get(id);
}

export function registerSpritesheet(id: string, sheet: SpriteSheet): void {
  spriteSheets.set(id, sheet);
  bumpAssetVersion();
}
export function unregisterSpritesheet(id: string): void {
  if (spriteSheets.delete(id)) bumpAssetVersion();
}
export function getSpritesheet(id: string): SpriteSheet | undefined {
  return spriteSheets.get(id);
}

export function registerAnimation(id: string, anim: Animation): void {
  animations.set(id, anim);
  bumpAssetVersion();
}
export function unregisterAnimation(id: string): void {
  if (animations.delete(id)) bumpAssetVersion();
}
export function getAnimation(id: string): Animation | undefined {
  return animations.get(id);
}

export function registerSound(id: string, sound: Sound): void {
  sounds.set(id, sound);
  bumpAssetVersion();
}
export function unregisterSound(id: string): void {
  if (sounds.delete(id)) bumpAssetVersion();
  soundBaseVolumes.delete(id);
}
export function getSound(id: string): Sound | undefined {
  return sounds.get(id);
}

// A separate registry for each Sound node's authored base volume — read
// by consumers (sound modifier, playSound collision action) when they
// trigger plays. Reading from sound.volume directly didn't work because
// Excalibur's `snd.play(v)` overwrites snd.volume with v, so each
// subsequent play multiplied a progressively smaller base.
const soundBaseVolumes = new Map<string, number>();
export function setSoundBaseVolume(id: string, volume: number): void {
  soundBaseVolumes.set(id, volume);
}
export function getSoundBaseVolume(id: string): number {
  return soundBaseVolumes.get(id) ?? 1;
}

export function registerTiledMap(id: string, map: unknown): void {
  tiledMaps.set(id, map);
  bumpAssetVersion();
}
export function unregisterTiledMap(id: string): void {
  if (tiledMaps.delete(id)) bumpAssetVersion();
}
export function getTiledMap(id: string): unknown {
  return tiledMaps.get(id);
}

export function getAllLoadableAssets(): unknown[] {
  // Excalibur's Loader accepts any Loadable; the registries hold a mix of
  // ImageSource / Sound / TiledResource. Sprite sheets and Animations are
  // derived from ImageSources so don't need separate preloading.
  return [
    ...imageSources.values(),
    ...sounds.values(),
    ...tiledMaps.values(),
  ];
}

export function clearAllAssets(): void {
  imageSources.clear();
  spriteSheets.clear();
  animations.clear();
  sounds.clear();
  tiledMaps.clear();
}
