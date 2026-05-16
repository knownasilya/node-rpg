import { Actor, Vector, vec } from "excalibur";
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

export const SLOT_X = 4;
export const SLOT_GAP = 20;
export const ACTOR_WIDTH = 240;
export const SLOT_WIDTH = ACTOR_WIDTH - SLOT_X * 2;
