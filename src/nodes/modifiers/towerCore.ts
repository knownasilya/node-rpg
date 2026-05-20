import { Actor, Color, CollisionType, vec } from "excalibur";
import { HealthComponent } from "./ecs";
import { emit } from "./shared";

export type TowerCfg = {
  range: number;
  damage: number;
  cooldownMs: number;
  targetTag: string;
  killEvent?: string;
};

// Fire a tower once if its cooldown has elapsed: pick the nearest live target
// tagged `targetTag` within range, damage its HealthComponent (kill + emit on
// 0 HP), and spawn a cosmetic projectile. Shared by the Tower modifier (graph
// towers) and the Build Menu (runtime-placed towers). `lastShot` is a per-
// tower timestamp map the caller owns. No-ops if the tower's scene isn't the
// active one.
export function fireTower(
  tower: Actor,
  cfg: TowerCfg,
  lastShot: Map<number, number>,
  now: number,
): void {
  const scene = tower.scene;
  if (!scene) return;
  const eng: any = (scene as any).engine;
  if (eng?.currentScene && eng.currentScene !== scene) return;
  if (now - (lastShot.get(tower.id) ?? -1e9) < cfg.cooldownMs) return;

  let best: Actor | undefined;
  let bestD2 = cfg.range * cfg.range;
  for (const o of scene.actors) {
    if (o === tower || !o.hasTag(cfg.targetTag) || o.isKilled?.()) continue;
    const dx = o.pos.x - tower.pos.x;
    const dy = o.pos.y - tower.pos.y;
    const d2 = dx * dx + dy * dy;
    if (d2 <= bestD2) {
      bestD2 = d2;
      best = o;
    }
  }
  if (!best) return;
  lastShot.set(tower.id, now);

  const hp = best.get(HealthComponent);
  if (hp) {
    hp.current = Math.max(0, hp.current - cfg.damage);
    if (hp.current <= 0) {
      try {
        best.kill();
      } catch {}
      if (cfg.killEvent?.trim()) emit(cfg.killEvent.trim(), { target: best }, "tower");
    }
  } else {
    try {
      best.kill();
    } catch {}
    if (cfg.killEvent?.trim()) emit(cfg.killEvent.trim(), { target: best }, "tower");
  }

  try {
    const dx = best.pos.x - tower.pos.x;
    const dy = best.pos.y - tower.pos.y;
    const len = Math.hypot(dx, dy) || 1;
    const p = new Actor({
      pos: vec(tower.pos.x, tower.pos.y - 6),
      width: 4,
      height: 4,
      color: Color.fromHex("#ffe066"),
      collisionType: CollisionType.PreventCollision,
    });
    p.vel = vec((dx / len) * 320, (dy / len) * 320);
    p.z = 50;
    scene.add(p);
    setTimeout(() => {
      try {
        p.kill();
      } catch {}
    }, 220);
  } catch {}
}
