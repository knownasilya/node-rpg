import {
  Actor,
  Component,
  Engine,
  Keys,
  MotionComponent,
  Query,
  Scene,
  System,
  SystemType,
  TileMap,
  TransformComponent,
  Vector,
  vec,
  World,
} from "excalibur";
import { emit } from "../shared";
import {
  MovementComponent,
  RequestedHeadingComponent,
} from "./core";

// === Components ===========================================================

export class GravityComponent extends Component {
  constructor(
    public gravity: number = 1200,
    public maxFallSpeed: number = 900,
    public enabled: boolean = true,
  ) {
    super();
  }
}

export class GroundedComponent extends Component {
  isGrounded: boolean = false;
  lastGroundedAt: number = 0;
  groundNormal: Vector = vec(0, -1);
  // Tags that count as ground when probed below the actor each tick.
  solidTags: string[];
  // Optional tag: when set and this entity transitions to grounded, the
  // event bus fires "<tag>-grounded". Keeps system noise low until a user
  // opts in (e.g., "player").
  emitTag?: string;

  constructor(solidTags: string[] = ["solid", "one-way-platform"]) {
    super();
    this.solidTags = solidTags;
  }
}

export class JumpComponent extends Component {
  jumpsUsed = 0;
  bufferedUntil = 0;
  isHoldingJump = false;
  private wasPressed = false;
  emitTag?: string;
  constructor(
    public jumpVelocity: number = 520,
    public variableHeightCutoff: number = 180,
    public coyoteMs: number = 100,
    public bufferMs: number = 120,
    public maxJumps: number = 1,
    public jumpKey: Keys = Keys.Space,
  ) {
    super();
  }
  // Called by JumpSystem each tick with the current key state so the
  // component can rising-/falling-edge detect cleanly.
  step(pressed: boolean): { rising: boolean; falling: boolean } {
    const rising = pressed && !this.wasPressed;
    const falling = !pressed && this.wasPressed;
    this.wasPressed = pressed;
    this.isHoldingJump = pressed;
    return { rising, falling };
  }
}

export class PlatformerControllerComponent extends Component {
  constructor(
    public maxSpeed: number = 220,
    public accel: number = 1800,
    public friction: number = 1600,
    public airControl: number = 0.7,
  ) {
    super();
  }
}

export class CameraFollowComponent extends Component {
  constructor(
    public axes: { x: boolean; y: boolean } = { x: true, y: true },
    public deadzone: { w: number; h: number } = { w: 60, h: 40 },
    public lerp: number = 0.12,
    public offset: Vector = vec(0, 0),
    public bounds?: { x: number; y: number; w: number; h: number },
  ) {
    super();
  }
}

// === Combat components (opt-in v1) =======================================

export interface BoxShape {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class HitboxComponent extends Component {
  constructor(
    public shapes: BoxShape[] = [],
    public damage: number = 1,
    // Tags this hitbox can hurt — matched against a target's HurtboxComponent.tags
    public targetTags: string[] = [],
    public active: boolean = true,
  ) {
    super();
  }
}

export class HurtboxComponent extends Component {
  invincibleUntil: number = 0;
  constructor(
    public shapes: BoxShape[] = [],
    public tags: string[] = [],
    public iFrameMs: number = 300,
  ) {
    super();
  }
}

export type OnZero = "kill" | "respawn" | "emit";

export class HealthComponent extends Component {
  current: number;
  constructor(
    public max: number = 3,
    public onZero: OnZero = "kill",
    public emitEvent?: string,
  ) {
    super();
    this.current = max;
  }
}

// === Systems ==============================================================

export class PlatformerMovementSystem extends System {
  static priority = -70;
  systemType = SystemType.Update;
  query: Query<
    | typeof PlatformerControllerComponent
    | typeof RequestedHeadingComponent
    | typeof MotionComponent
  >;
  constructor(public world: World) {
    super();
    this.query = world.query([
      PlatformerControllerComponent,
      RequestedHeadingComponent,
      MotionComponent,
    ]);
  }
  update(elapsedMs: number): void {
    const dt = elapsedMs / 1000;
    for (const e of this.query.entities) {
      // Skip entities that also have classic MovementComponent — the snake
      // and other top-down setups should keep their existing controller.
      if (e.get(MovementComponent)) continue;
      const ctrl = e.get(PlatformerControllerComponent);
      const req = e.get(RequestedHeadingComponent);
      const motion = e.get(MotionComponent);
      if (!ctrl || !req || !motion) continue;
      const grounded = e.get(GroundedComponent)?.isGrounded ?? true;
      const factor = grounded ? 1 : ctrl.airControl;
      const targetVx = req.heading.x * ctrl.maxSpeed;
      let vx = motion.vel.x;
      if (req.heading.x !== 0) {
        const a = ctrl.accel * factor * dt;
        if (vx < targetVx) vx = Math.min(targetVx, vx + a);
        else if (vx > targetVx) vx = Math.max(targetVx, vx - a);
      } else {
        const f = ctrl.friction * factor * dt;
        if (vx > 0) vx = Math.max(0, vx - f);
        else if (vx < 0) vx = Math.min(0, vx + f);
      }
      motion.vel = vec(vx, motion.vel.y);
    }
  }
}

export class GravitySystem extends System {
  static priority = -60;
  systemType = SystemType.Update;
  query: Query<typeof GravityComponent | typeof MotionComponent>;
  constructor(public world: World) {
    super();
    this.query = world.query([GravityComponent, MotionComponent]);
  }
  update(elapsedMs: number): void {
    const dt = elapsedMs / 1000;
    for (const e of this.query.entities) {
      const g = e.get(GravityComponent);
      const motion = e.get(MotionComponent);
      if (!g || !motion || !g.enabled) continue;
      const grounded = e.get(GroundedComponent);
      // While resting on a platform with downward velocity, clamp to zero so
      // physics doesn't keep accumulating into the surface.
      if (grounded?.isGrounded && motion.vel.y > 0) {
        motion.vel = vec(motion.vel.x, 0);
        continue;
      }
      const newVy = Math.min(g.maxFallSpeed, motion.vel.y + g.gravity * dt);
      motion.vel = vec(motion.vel.x, newVy);
    }
  }
}

// Poll-based ground detection. The event-driven version proved flaky
// because Excalibur fires collisionstart/end across substeps and our
// manual unground-on-jump fought the natural event flow, stranding
// `isGrounded` at false and blocking the second jump. Each tick this
// system sweeps a thin AABB below the actor for any solid-tagged actor
// and sets isGrounded accordingly.
// Returns world-space bounds for an actor, preferring Excalibur's collider
// bounds (handles CompositeCollider for graphicGroup) and falling back to
// pos + width/height (covers player Actor constructed with width/height).
function actorWorldBounds(actor: Actor): {
  left: number;
  right: number;
  top: number;
  bottom: number;
} | undefined {
  const c: any = (actor as any).collider;
  const b: any =
    c?.bounds ??
    c?.get?.()?.bounds ??
    c?.collider?.bounds;
  if (b && typeof b.left === "number") {
    return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
  }
  const w = (actor as any).width ?? 0;
  const h = (actor as any).height ?? 0;
  if (w <= 0 || h <= 0) return undefined;
  return {
    left: actor.pos.x - w / 2,
    right: actor.pos.x + w / 2,
    top: actor.pos.y - h / 2,
    bottom: actor.pos.y + h / 2,
  };
}

export class GroundedSystem extends System {
  static priority = -55;
  systemType = SystemType.Update;
  query: Query<typeof GroundedComponent | typeof TransformComponent>;
  constructor(public world: World) {
    super();
    this.query = world.query([GroundedComponent, TransformComponent]);
  }
  update(): void {
    const scene = this.world.scene;
    if (!scene) return;
    const now = performance.now();
    for (const e of this.query.entities) {
      const gc = e.get(GroundedComponent);
      if (!gc) continue;
      const actor = e instanceof Actor ? e : undefined;
      if (!actor) continue;
      const b = actorWorldBounds(actor);
      if (!b) continue;
      // Probe a thin strip just below the actor's feet.
      const probe = {
        left: b.left + 1,
        right: b.right - 1,
        top: b.bottom - 1,
        bottom: b.bottom + 4,
      };
      let grounded = false;
      // Tagged Actors (graphicGroup floors, walls): standard AABB sweep.
      for (const other of scene.actors) {
        if (other === actor) continue;
        if (!gc.solidTags.some((t) => other.hasTag(t))) continue;
        const ob = actorWorldBounds(other);
        if (!ob) continue;
        if (
          probe.left < ob.right &&
          probe.right > ob.left &&
          probe.top < ob.bottom &&
          probe.bottom > ob.top
        ) {
          grounded = true;
          break;
        }
      }
      // Tiled TileMaps: TileMap extends Entity (not Actor) and isn't tag-
      // matched. We sample a few points along the actor's bottom edge for
      // a tile. If one is solid/non-empty we ground the player AND snap
      // them out of any overlap with vel.y zeroed — relying purely on
      // Excalibur's Arcade solver to resolve a TileMap collision was
      // letting the player gradually tunnel ("quicksand"); the snap +
      // velocity clamp here is the reliable platformer behavior.
      let groundTileTopWorldY: number | undefined;
      if (!grounded) {
        const tilemaps: TileMap[] = [];
        for (const ent of scene.entities) {
          if (ent instanceof TileMap) tilemaps.push(ent);
        }
        if (tilemaps.length > 0) {
          const sampleXs = [
            b.left + 1,
            (b.left + b.right) / 2,
            b.right - 1,
          ];
          // Sample two y's: one just below the actor's feet, one a few
          // pixels inside (catches the "tunneled deeper than the probe"
          // case when fall velocity exceeds the per-frame probe depth).
          const sampleYs = [b.bottom + 1, b.bottom - 1, b.bottom + 6];
          outer: for (const tm of tilemaps) {
            for (const sy of sampleYs) {
              for (const sx of sampleXs) {
                const tile = tm.getTileByPoint(vec(sx, sy));
                if (!tile?.solid) continue;
                grounded = true;
                // The tile's world-space top edge.
                groundTileTopWorldY = tile.pos.y;
                break outer;
              }
            }
          }
        }
      }
      // If we found a tile under the player, snap them flush with its top
      // and clear downward velocity. Without this the player sinks frame-
      // by-frame because Excalibur's solver only nudges overlap and leaves
      // gravity-accumulated velocity intact. We gate on vel.y >= 0 so a
      // jump-in-progress (vel.y < 0) is never clobbered — otherwise the
      // probe samples (which intentionally extend a few px below the
      // actor's feet) can still find the tile the player just launched
      // from on the very next tick, and the snap would yank them back
      // down to the tile top before they ever leave it.
      if (grounded && groundTileTopWorldY !== undefined) {
        const motion = actor.get(MotionComponent);
        const goingUp = !!motion && motion.vel.y < 0;
        if (!goingUp) {
          const h = b.bottom - b.top;
          const targetCenterY = groundTileTopWorldY - h / 2;
          if (actor.pos.y > targetCenterY) {
            actor.pos = vec(actor.pos.x, targetCenterY);
          }
          if (motion && motion.vel.y > 0) {
            motion.vel = vec(motion.vel.x, 0);
          }
        }
      }
      const wasGrounded = gc.isGrounded;
      gc.isGrounded = grounded;
      if (grounded) {
        gc.lastGroundedAt = now;
        if (!wasGrounded && gc.emitTag) {
          emit(`${gc.emitTag}-grounded`, { actor });
        }
      }
    }
  }
}

export class JumpSystem extends System {
  static priority = -50;
  systemType = SystemType.Update;
  query: Query<typeof JumpComponent | typeof MotionComponent>;
  constructor(public world: World) {
    super();
    this.query = world.query([JumpComponent, MotionComponent]);
  }
  update(): void {
    const engine: Engine | undefined = this.world.scene?.engine;
    if (!engine) return;
    const kb = engine.input.keyboard;
    const now = performance.now();
    for (const e of this.query.entities) {
      const jc = e.get(JumpComponent);
      const motion = e.get(MotionComponent);
      if (!jc || !motion) continue;
      const grounded = e.get(GroundedComponent);
      const pressed = kb.isHeld(jc.jumpKey);
      const { rising, falling } = jc.step(pressed);

      // Reset air-jump counter on rising-edge grounded.
      if (grounded?.isGrounded && jc.jumpsUsed > 0) {
        jc.jumpsUsed = 0;
      }

      const onGround =
        grounded?.isGrounded ||
        (grounded ? now - grounded.lastGroundedAt < jc.coyoteMs : false);

      const canJump = onGround || jc.jumpsUsed < jc.maxJumps;

      if (rising) {
        if (canJump) {
          motion.vel = vec(motion.vel.x, -jc.jumpVelocity);
          jc.jumpsUsed++;
          if (jc.emitTag) emit(`${jc.emitTag}-jumped`, { actor: e });
        } else {
          jc.bufferedUntil = now + jc.bufferMs;
        }
      } else if (
        jc.bufferedUntil > now &&
        grounded?.isGrounded
      ) {
        motion.vel = vec(motion.vel.x, -jc.jumpVelocity);
        jc.jumpsUsed++;
        jc.bufferedUntil = 0;
        if (jc.emitTag) emit(`${jc.emitTag}-jumped`, { actor: e });
      }

      // Variable-height: cut upward velocity on early release.
      if (falling && motion.vel.y < -jc.variableHeightCutoff) {
        motion.vel = vec(motion.vel.x, -jc.variableHeightCutoff);
      }
    }
  }
}

export class CameraFollowSystem extends System {
  static priority = 90;
  systemType = SystemType.Update;
  query: Query<typeof CameraFollowComponent | typeof TransformComponent>;
  constructor(public world: World) {
    super();
    this.query = world.query([CameraFollowComponent, TransformComponent]);
  }
  update(): void {
    const scene = this.world.scene;
    if (!scene) return;
    // First-with-component wins for deterministic ordering.
    const e = this.query.entities[0];
    if (!e) return;
    const cf = e.get(CameraFollowComponent);
    const tx = e.get(TransformComponent);
    if (!cf || !tx) return;
    const target = vec(tx.pos.x + cf.offset.x, tx.pos.y + cf.offset.y);
    const cam = scene.camera;
    const dx = target.x - cam.pos.x;
    const dy = target.y - cam.pos.y;
    const halfW = cf.deadzone.w / 2;
    const halfH = cf.deadzone.h / 2;
    let nx = cam.pos.x;
    let ny = cam.pos.y;
    if (cf.axes.x && Math.abs(dx) > halfW) {
      const excess = dx > 0 ? dx - halfW : dx + halfW;
      nx = cam.pos.x + excess * cf.lerp;
    }
    if (cf.axes.y && Math.abs(dy) > halfH) {
      const excess = dy > 0 ? dy - halfH : dy + halfH;
      ny = cam.pos.y + excess * cf.lerp;
    }
    if (cf.bounds) {
      nx = Math.max(cf.bounds.x, Math.min(cf.bounds.x + cf.bounds.w, nx));
      ny = Math.max(cf.bounds.y, Math.min(cf.bounds.y + cf.bounds.h, ny));
    }
    cam.pos = vec(nx, ny);
  }
}

// AABB hit/hurt overlap test. v1: shapes are in actor-local space; we add
// the actor's world position to translate. No rotation support.
function boxesOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

export class HitboxSystem extends System {
  static priority = 80;
  systemType = SystemType.Update;
  hitQuery: Query<typeof HitboxComponent | typeof TransformComponent>;
  hurtQuery: Query<typeof HurtboxComponent | typeof TransformComponent>;
  constructor(public world: World) {
    super();
    this.hitQuery = world.query([HitboxComponent, TransformComponent]);
    this.hurtQuery = world.query([HurtboxComponent, TransformComponent]);
  }
  update(): void {
    const now = performance.now();
    const hits = this.hitQuery.entities;
    const hurts = this.hurtQuery.entities;
    if (hits.length === 0 || hurts.length === 0) return;
    for (const ha of hits) {
      const hb = ha.get(HitboxComponent);
      const hat = ha.get(TransformComponent);
      if (!hb || !hat || !hb.active) continue;
      for (const va of hurts) {
        if (va === ha) continue;
        const vb = va.get(HurtboxComponent);
        const vat = va.get(TransformComponent);
        if (!vb || !vat) continue;
        if (vb.invincibleUntil > now) continue;
        const tagsMatch =
          hb.targetTags.length === 0 ||
          hb.targetTags.some((t) => vb.tags.includes(t));
        if (!tagsMatch) continue;
        const hitsOverlap = hb.shapes.some((hs) =>
          vb.shapes.some((vs) =>
            boxesOverlap(
              { x: hat.pos.x + hs.x, y: hat.pos.y + hs.y, w: hs.w, h: hs.h },
              { x: vat.pos.x + vs.x, y: vat.pos.y + vs.y, w: vs.w, h: vs.h },
            ),
          ),
        );
        if (!hitsOverlap) continue;
        const health = va.get(HealthComponent);
        // Pin the victim's animation to "hurt" for the iframe window, or
        // "death" forever when HP runs out. Looked up by constructor name
        // so this file doesn't pull in modifiers/animation.tsx (which
        // would create a circular import — animation.tsx → ecs barrel
        // → platformer.ts).
        const components: any[] = (va as any).getComponents?.() ?? [];
        const anim = components.find(
          (c: any) => c?.constructor?.name === "AnimationComponent",
        );
        let died = false;
        if (health) {
          health.current = Math.max(0, health.current - hb.damage);
          if (health.current === 0) {
            died = true;
            if (anim?.pin) anim.pin("death", Number.POSITIVE_INFINITY);
            if (health.onZero === "kill" && va instanceof Actor) {
              // Delay the kill so the death pin actually has a tick to
              // render before the actor is removed from the scene.
              setTimeout(() => {
                try {
                  if (!va.isKilled?.()) va.kill();
                } catch {}
              }, 250);
            } else if (health.onZero === "emit" && health.emitEvent) {
              emit(health.emitEvent, { actor: va });
            }
          }
        }
        if (!died && anim?.pin) anim.pin("hurt", vb.iFrameMs);
        vb.invincibleUntil = now + vb.iFrameMs;
        emit("damage-dealt", { attacker: ha, victim: va, amount: hb.damage });
      }
    }
  }
}

// Debug overlay: draws hitboxes (red) and hurtboxes (blue) onto the scene's
// graphics context. Registered conditionally from the Game node header
// toggle; off by default.
export class HitboxDebugSystem extends System {
  static priority = 200;
  systemType = SystemType.Draw;
  hitQuery: Query<typeof HitboxComponent | typeof TransformComponent>;
  hurtQuery: Query<typeof HurtboxComponent | typeof TransformComponent>;
  constructor(public world: World) {
    super();
    this.hitQuery = world.query([HitboxComponent, TransformComponent]);
    this.hurtQuery = world.query([HurtboxComponent, TransformComponent]);
  }
  update(_elapsed: number): void {
    const scene = this.world.scene;
    const ctx: any = (scene as any)?.engine?.graphicsContext;
    if (!ctx) return;
    for (const e of this.hitQuery.entities) {
      const hb = e.get(HitboxComponent);
      const tx = e.get(TransformComponent);
      if (!hb || !tx) continue;
      for (const s of hb.shapes) {
        ctx.drawRectangle?.(
          vec(tx.pos.x + s.x, tx.pos.y + s.y),
          s.w,
          s.h,
          { r: 255, g: 64, b: 64, a: 0.25 } as any,
          { r: 255, g: 64, b: 64, a: 0.9 } as any,
          1,
        );
      }
    }
    for (const e of this.hurtQuery.entities) {
      const hb = e.get(HurtboxComponent);
      const tx = e.get(TransformComponent);
      if (!hb || !tx) continue;
      for (const s of hb.shapes) {
        ctx.drawRectangle?.(
          vec(tx.pos.x + s.x, tx.pos.y + s.y),
          s.w,
          s.h,
          { r: 64, g: 128, b: 255, a: 0.25 } as any,
          { r: 64, g: 128, b: 255, a: 0.9 } as any,
          1,
        );
      }
    }
  }
}

export function registerPlatformerSystems(scene: Scene): void {
  scene.world.add(PlatformerMovementSystem);
  scene.world.add(GravitySystem);
  scene.world.add(GroundedSystem);
  scene.world.add(JumpSystem);
  scene.world.add(CameraFollowSystem);
  scene.world.add(HitboxSystem);
}
