import {
  Actor,
  Component,
  Engine,
  Entity,
  Keys,
  MotionComponent,
  Query,
  Scene,
  System,
  SystemType,
  TransformComponent,
  Vector,
  vec,
  World,
} from "excalibur";
import {
  callSpawner,
  callTailGrower,
  emit,
  getLeaderHistoryPos,
  getAnimation,
  getSound,
  getSoundBaseVolume,
  recordLeaderPos,
  registerSpawner,
  registerTailGrower,
  unregisterSpawner,
  unregisterTailGrower,
} from "../shared";

// === Components ===========================================================

export type ControlScheme = "wasd" | "arrows";

const controlSchemes: Record<
  ControlScheme,
  { up: Keys; down: Keys; left: Keys; right: Keys }
> = {
  wasd: { up: Keys.W, down: Keys.S, left: Keys.A, right: Keys.D },
  arrows: {
    up: Keys.Up,
    down: Keys.Down,
    left: Keys.Left,
    right: Keys.Right,
  },
};

export class InputComponent extends Component {
  constructor(public scheme: ControlScheme = "wasd") {
    super();
  }
}

export class RequestedHeadingComponent extends Component {
  heading: Vector = vec(0, 0);
}

export type MovementStyle = "velocity" | "grid-step" | "continuous-heading";

export type AxisLock = "none" | "x" | "y";

export class MovementComponent extends Component {
  accumulator = 0;
  latchedHeading: Vector = vec(0, 0);
  constructor(
    public style: MovementStyle = "velocity",
    public speed: number = 100,
    public tickMs: number = 150,
    public cellSize: number = 20,
    // Restrict motion to a single axis: "y" = vertical only (e.g. a pong
    // paddle), "x" = horizontal only, "none" = free.
    public axisLock: AxisLock = "none",
  ) {
    super();
  }
}

export class FollowerComponent extends Component {
  // When set, the follower applies this tag to its owner the first frame the
  // owner's position differs from the leader's — used by Tail segments so a
  // head-vs-tail collision rule doesn't fire on the spawn tick.
  tagOnceOffLeader?: string;
  private _tagged = false;
  constructor(
    public leaderTag: string,
    public delay: number = 1,
  ) {
    super();
  }
  markTagged() {
    this._tagged = true;
  }
  get tagged(): boolean {
    return this._tagged;
  }
}

export class InitialPosComponent extends Component {
  constructor(public pos: Vector) {
    super();
  }
}

// Enemy chase AI. Steers toward the nearest actor carrying `targetTag` when
// it's within `aggroRange`. Writes only a normalized heading into
// RequestedHeadingComponent — speed is owned by the entity's
// MovementComponent (style "velocity"), so the existing MovementSystem turns
// that heading into velocity. Pair with a MovementComponent on the same actor.
export class ChaseComponent extends Component {
  constructor(
    public targetTag: string = "player",
    public aggroRange: number = 120,
    // Stop pursuing once within this many px of the target (center-to-center),
    // so the chaser holds at the player's edge instead of stacking on top.
    // 0 = chase all the way to the target center (original behavior).
    public stopDistance: number = 0,
  ) {
    super();
  }
}

export type CollisionAction =
  | "kill"
  | "log"
  | "respawn"
  | "removeOther"
  | "growTail"
  | "relocate"
  | "callSpawner"
  | "playSound"
  | "playAnimation"
  | "emitEvent"
  | "damage"
  | "bounce"
  | "switchScene";

export interface CollisionRule {
  // Stable id from the React-Flow node so the component can update or remove
  // a specific rule without disturbing siblings.
  id: string;
  targetTag: string;
  action: CollisionAction;
  growTailFor?: string;
  spawnerTag?: string;
  // The relocate action needs editor context (scene dims/cellSize); the React
  // layer supplies it as a closure.
  onRelocate?: (other: Actor) => void;
  playSoundKey?: string;
  playSoundVolume?: number;
  playAnimationKey?: string;
  emitEventName?: string;
  emitEventPayload?: Record<string, unknown>;
  damageAmount?: number;
  bounceVelocity?: number;
  // switchScene: route to another connected Scene by its node id (e.g.
  // "scene-2"). If sceneSpawn coords are set, the actor is teleported to
  // that position in the new scene. The triggering door actor stays put
  // in its origin scene; only the player-tagged actor moves.
  targetSceneId?: string;
  sceneSpawnX?: number;
  sceneSpawnY?: number;
}

// Excalibur's addComponent silently rejects a duplicate-class component, so a
// single CollisionRulesComponent per actor owns a list of rules. Modifiers
// upsert/remove entries by id.
export class CollisionRulesComponent extends Component {
  rules: CollisionRule[] = [];
  private handler?: (evt: any) => void;
  private boundOwner?: Actor;

  upsert(rule: CollisionRule): void {
    const i = this.rules.findIndex((r) => r.id === rule.id);
    if (i >= 0) this.rules[i] = rule;
    else this.rules.push(rule);
  }
  remove(id: string): void {
    this.rules = this.rules.filter((r) => r.id !== id);
  }
  hasRules(): boolean {
    return this.rules.length > 0;
  }

  onAdd(owner: Entity): void {
    if (!(owner instanceof Actor)) return;
    const actor = owner;
    this.boundOwner = actor;
    this.handler = (evt: any) => {
      const other = evt.other?.owner as Actor | undefined;
      if (!other) return;
      // Snapshot so a rule that kills `actor` and triggers removal of this
      // component doesn't trip iteration.
      const rules = this.rules.slice();
      for (const rule of rules) {
        const tag = rule.targetTag.trim();
        if (!tag || !other.hasTag(tag)) continue;
        applyRule(actor, other, rule);
      }
    };
    actor.on("collisionstart", this.handler as any);
  }
  onRemove(): void {
    if (this.handler && this.boundOwner) {
      this.boundOwner.off("collisionstart", this.handler as any);
    }
    this.handler = undefined;
    this.boundOwner = undefined;
  }
}

function applyRule(actor: Actor, other: Actor, rule: CollisionRule): void {
  switch (rule.action) {
    case "kill":
      actor.kill();
      break;
    case "log":
      console.debug("[CollisionRule]", actor.name, "→", other.name, {
        tags: Array.from(other.tags),
      });
      break;
    case "respawn": {
      const init = actor.get(InitialPosComponent);
      if (init) {
        actor.pos = vec(init.pos.x, init.pos.y);
        actor.vel = vec(0, 0);
      }
      break;
    }
    case "removeOther":
      other.kill();
      break;
    case "growTail": {
      const t = (rule.growTailFor ?? "").trim();
      if (!t) return;
      if (!callTailGrower(t, 1)) {
        console.warn(
          `[growTail] no Tail registered with leaderTag="${t}"; skipping grow`,
        );
      }
      break;
    }
    case "relocate":
      rule.onRelocate?.(other);
      break;
    case "callSpawner": {
      const t = (rule.spawnerTag ?? "").trim();
      if (!t) {
        console.warn("[callSpawner] no spawnerTag set");
        return;
      }
      if (!callSpawner(t)) {
        console.warn(
          `[callSpawner] no spawner registered with tag "${t}"`,
        );
      }
      break;
    }
    case "playSound": {
      const key = (rule.playSoundKey ?? "").trim();
      if (!key) return;
      const snd = getSound(key);
      if (snd) {
        // Multiply the rule's volume by the Sound node's authored base
        // volume from the side-registry. Reading snd.volume directly would
        // compound: Excalibur's snd.play(v) overwrites snd.volume = v.
        snd.play(getSoundBaseVolume(key) * (rule.playSoundVolume ?? 1));
      }
      break;
    }
    case "playAnimation": {
      const key = (rule.playAnimationKey ?? "").trim();
      if (!key) return;
      const anim = getAnimation(key);
      if (anim) actor.graphics.use(anim);
      break;
    }
    case "emitEvent": {
      const name = (rule.emitEventName ?? "").trim();
      if (!name) return;
      emit(
        name,
        {
          ...(rule.emitEventPayload ?? {}),
          self: actor,
          other,
        },
        "collisionRule",
      );
      break;
    }
    case "damage": {
      // Resolve HealthComponent by its stable runtime shape rather than a
      // static import (which would create a core→platformer→core cycle) or
      // `constructor.name` (which minifies away in production builds). esbuild
      // preserves property names, so duck-typing on current/max/onZero is safe.
      const amount = rule.damageAmount ?? 1;
      const components = (other as any).getComponents?.() ?? [];
      for (const c of components) {
        if (
          c &&
          typeof (c as any).current === "number" &&
          typeof (c as any).max === "number" &&
          "onZero" in (c as any)
        ) {
          (c as any).current = Math.max(0, (c as any).current - amount);
        }
      }
      break;
    }
    case "bounce": {
      const v = rule.bounceVelocity ?? 200;
      actor.vel = vec(actor.vel.x, -v);
      break;
    }
    case "switchScene": {
      const target = (rule.targetSceneId ?? "").trim();
      if (!target) {
        console.warn("[switchScene] no targetSceneId set");
        return;
      }
      const engine = actor.scene?.engine;
      if (!engine) return;
      const targetScene = (engine as any).scenes?.[target];
      if (!targetScene) {
        console.warn(`[switchScene] no scene with id "${target}" registered`);
        return;
      }
      // Move the actor from current scene to target so the player persists
      // across the transition. Fall back to leaving the actor put if the
      // engine doesn't expose the helpers.
      const fromScene = actor.scene;
      try {
        fromScene?.remove(actor);
      } catch {}
      try {
        (targetScene as any).add(actor);
      } catch {}
      if (rule.sceneSpawnX !== undefined || rule.sceneSpawnY !== undefined) {
        actor.pos = vec(
          rule.sceneSpawnX ?? actor.pos.x,
          rule.sceneSpawnY ?? actor.pos.y,
        );
        actor.vel = vec(0, 0);
      }
      engine.goToScene(target);
      break;
    }
  }
}

export class SpawnerComponent extends Component {
  constructor(
    public tag: string,
    public spawn: () => void,
  ) {
    super();
  }
  onAdd(): void {
    const t = this.tag.trim();
    if (t) registerSpawner(t, this.spawn);
  }
  onRemove(): void {
    const t = this.tag.trim();
    if (t) unregisterSpawner(t);
  }
}

export class TailGrowerComponent extends Component {
  constructor(
    public leaderTag: string,
    public grow: (delta: number) => void,
  ) {
    super();
  }
  onAdd(): void {
    const t = this.leaderTag.trim();
    if (t) registerTailGrower(t, this.grow);
  }
  onRemove(): void {
    const t = this.leaderTag.trim();
    if (t) unregisterTailGrower(t);
  }
}

// === Systems ==============================================================

function snap(value: number, cell: number): number {
  return Math.round((value - cell / 2) / cell) * cell + cell / 2;
}

function latchCardinal(requested: Vector, last: Vector): Vector {
  if (requested.x !== 0 && last.y !== 0) {
    return vec(Math.sign(requested.x), 0);
  }
  if (requested.y !== 0 && last.x !== 0) {
    return vec(0, Math.sign(requested.y));
  }
  if (last.x === 0 && last.y === 0) {
    if (requested.x !== 0) return vec(Math.sign(requested.x), 0);
    if (requested.y !== 0) return vec(0, Math.sign(requested.y));
  }
  return last;
}

export class InputSystem extends System {
  static priority = -100;
  systemType = SystemType.Update;
  query: Query<typeof InputComponent | typeof RequestedHeadingComponent>;
  constructor(public world: World) {
    super();
    this.query = world.query([InputComponent, RequestedHeadingComponent]);
  }
  update(): void {
    const engine: Engine | undefined = this.world.scene?.engine;
    if (!engine) return;
    const kb = engine.input.keyboard;
    for (const e of this.query.entities) {
      const input = e.get(InputComponent);
      const heading = e.get(RequestedHeadingComponent);
      if (!input || !heading) continue;
      const scheme = controlSchemes[input.scheme];
      const x = kb.isHeld(scheme.left) ? -1 : kb.isHeld(scheme.right) ? 1 : 0;
      const y = kb.isHeld(scheme.up) ? -1 : kb.isHeld(scheme.down) ? 1 : 0;
      heading.heading = vec(x, y);
    }
  }
}

export class MovementSystem extends System {
  static priority = -50;
  systemType = SystemType.Update;
  query: Query<
    | typeof MovementComponent
    | typeof RequestedHeadingComponent
    | typeof TransformComponent
    | typeof MotionComponent
  >;
  constructor(public world: World) {
    super();
    this.query = world.query([
      MovementComponent,
      RequestedHeadingComponent,
      TransformComponent,
      MotionComponent,
    ]);
  }
  update(elapsed: number): void {
    for (const e of this.query.entities) {
      const m = e.get(MovementComponent);
      const req = e.get(RequestedHeadingComponent);
      const transform = e.get(TransformComponent);
      const motion = e.get(MotionComponent);
      if (!m || !req || !transform || !motion) continue;
      const h = req.heading;

      if (m.style === "velocity") {
        const lx = m.axisLock === "y" ? 0 : h.x;
        const ly = m.axisLock === "x" ? 0 : h.y;
        motion.vel = vec(lx * m.speed, ly * m.speed);
      } else if (m.style === "grid-step") {
        motion.vel = vec(0, 0);
        m.latchedHeading = latchCardinal(h, m.latchedHeading);
        m.accumulator += elapsed;
        if (m.accumulator >= m.tickMs) {
          m.accumulator -= m.tickMs;
          const lh = m.latchedHeading;
          if (lh.x === 0 && lh.y === 0) continue;
          transform.pos = vec(
            snap(transform.pos.x, m.cellSize) + lh.x * m.cellSize,
            snap(transform.pos.y, m.cellSize) + lh.y * m.cellSize,
          );
        }
      } else {
        m.latchedHeading = latchCardinal(h, m.latchedHeading);
        const lh = m.latchedHeading;
        motion.vel = vec(lh.x * m.speed, lh.y * m.speed);
      }
    }
  }
}

// Records position history for any leader tag that at least one follower is
// asking about. Avoids requiring a LeaderComponent UI knob — any tagged actor
// can be a leader, matching the pre-ECS behavior.
export class LeaderHistorySystem extends System {
  static priority = -10;
  systemType = SystemType.Update;
  followerQuery: Query<typeof FollowerComponent>;
  constructor(public world: World) {
    super();
    this.followerQuery = world.query([FollowerComponent]);
  }
  update(): void {
    const wantedTags = new Set<string>();
    for (const f of this.followerQuery.entities) {
      const fc = f.get(FollowerComponent);
      if (!fc) continue;
      const t = fc.leaderTag.trim();
      if (t) wantedTags.add(t);
    }
    if (wantedTags.size === 0) return;
    const scene = this.world.scene;
    if (!scene) return;
    for (const a of scene.actors) {
      for (const t of wantedTags) {
        if (a.hasTag(t)) recordLeaderPos(t, a.pos);
      }
    }
  }
}

export class FollowerSystem extends System {
  static priority = 0;
  systemType = SystemType.Update;
  query: Query<
    | typeof FollowerComponent
    | typeof TransformComponent
    | typeof MotionComponent
  >;
  constructor(public world: World) {
    super();
    this.query = world.query([
      FollowerComponent,
      TransformComponent,
      MotionComponent,
    ]);
  }
  update(): void {
    for (const e of this.query.entities) {
      const f = e.get(FollowerComponent);
      const transform = e.get(TransformComponent);
      const motion = e.get(MotionComponent);
      if (!f || !transform || !motion) continue;
      const tag = f.leaderTag.trim();
      if (!tag) continue;
      const target = getLeaderHistoryPos(tag, f.delay);
      if (target) {
        transform.pos = vec(target.x, target.y);
        motion.vel = vec(0, 0);
      }
      // Apply the segment tag once the follower has moved off the leader,
      // so a leader↔segment collision rule won't fire on the spawn frame.
      if (!f.tagged && f.tagOnceOffLeader && e instanceof Actor) {
        const leader = this.world.scene?.actors.find((a) => a.hasTag(tag));
        if (
          leader &&
          (e.pos.x !== leader.pos.x || e.pos.y !== leader.pos.y)
        ) {
          e.addTag(f.tagOnceOffLeader);
          f.markTagged();
        }
      }
    }
  }
}

// Steers chasers toward the nearest tagged target. Runs at -90: after
// InputSystem (-100) so it never fights player input, and before
// MovementSystem (-50) which consumes the heading it writes. Crucially it
// writes the heading EVERY tick (zeroing it when out of range), because
// MovementSystem never clears a stale heading — a chaser that only wrote
// when in-range would keep drifting after the target left aggro.
export class ChaseSystem extends System {
  static priority = -90;
  systemType = SystemType.Update;
  query: Query<
    | typeof ChaseComponent
    | typeof RequestedHeadingComponent
    | typeof TransformComponent
  >;
  constructor(public world: World) {
    super();
    this.query = world.query([
      ChaseComponent,
      RequestedHeadingComponent,
      TransformComponent,
    ]);
  }
  update(): void {
    const scene = this.world.scene;
    if (!scene) return;
    for (const e of this.query.entities) {
      const chase = e.get(ChaseComponent);
      const req = e.get(RequestedHeadingComponent);
      const transform = e.get(TransformComponent);
      if (!chase || !req || !transform) continue;
      const tag = chase.targetTag.trim();
      const self = transform.pos;
      let nearest: Actor | undefined;
      let bestD2 = Infinity;
      if (tag) {
        for (const a of scene.actors) {
          if (!a.hasTag(tag)) continue;
          const dx = a.pos.x - self.x;
          const dy = a.pos.y - self.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < bestD2) {
            bestD2 = d2;
            nearest = a;
          }
        }
      }
      if (nearest && bestD2 <= chase.aggroRange * chase.aggroRange) {
        // Hold at the standoff distance so the chaser stops at the player's
        // edge instead of climbing on top of it.
        if (chase.stopDistance > 0 && bestD2 <= chase.stopDistance * chase.stopDistance) {
          req.heading = vec(0, 0);
        } else {
          const dx = nearest.pos.x - self.x;
          const dy = nearest.pos.y - self.y;
          const len = Math.hypot(dx, dy) || 1;
          req.heading = vec(dx / len, dy / len);
        }
      } else {
        req.heading = vec(0, 0);
      }
    }
  }
}

export function registerCoreEcsSystems(scene: Scene) {
  scene.world.add(InputSystem);
  scene.world.add(MovementSystem);
  scene.world.add(ChaseSystem);
  scene.world.add(LeaderHistorySystem);
  scene.world.add(FollowerSystem);
}
