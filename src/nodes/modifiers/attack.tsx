import { NodeProps } from "@xyflow/react";
import { Keys } from "excalibur";
import { useEffect, useState } from "preact/hooks";
import { Field, ModShell, TagsField } from "../../ui";
import {
  HitboxComponent,
  RequestedHeadingComponent,
  type BoxShape,
} from "./ecs";
import { emit, useParentActors } from "./shared";
import { PlayerAnimationStateComponent as AnimationComponent } from "./animation";
import { getActorFacing } from "./directionalAnimation";
import { StateChartComponent } from "./stateChart";

// While the actor's State Chart (if any) is in one of these states, the attack
// is suppressed — e.g. you can't swing mid-conversation. Matched by name so an
// author opts in just by naming a chart state. No chart ⇒ never suppressed.
const NO_ATTACK_STATE = /talking|menu|cutscene|dialog/i;

// How the swing hitbox is placed each attack:
//   facing    – platformer-style box in front, mirrored left/right via the
//               actor's graphics.flipHorizontal.
//   omni      – square centered on the actor (hits all directions).
//   direction – box in the actor's current 4-way facing (top-down). Reads the
//               Directional Anim component, falling back to movement heading.
//   target    – box aimed toward the nearest actor carrying a target tag
//               (e.g. an enemy swinging toward the player).
type HitboxMode = "facing" | "omni" | "direction" | "target";
const HITBOX_MODES: HitboxMode[] = ["facing", "omni", "direction", "target"];

// AttackModifier: presses an "attack" key to activate the actor's
// HitboxComponent for a short window AND pin the AnimationComponent's
// `attack` state for that window. The hitbox shape is mirrored when the
// actor's facing direction is left (using the actor.graphics.flipHorizontal
// the AnimationSelectorSystem already maintains).

const KEY_OPTIONS: { label: string; value: Keys }[] = [
  { label: "Space", value: Keys.Space },
  { label: "X", value: Keys.X },
  { label: "Z", value: Keys.Z },
  { label: "J", value: Keys.J },
  { label: "K", value: Keys.K },
  { label: "Enter", value: Keys.Enter },
];

export default function AttackModifier({ id, data, parentId }: NodeProps) {
  const actors = useParentActors(parentId);
  const actorsKey = actors.map((a) => a.id).join(",");
  const [attackKey, setAttackKey] = useState<Keys>(
    (data.attackKey as Keys | undefined) ?? Keys.X,
  );
  const [durationMs, setDurationMs] = useState<number>(
    (data.durationMs as number | undefined) ?? 250,
  );
  const [damage, setDamage] = useState<number>(
    (data.damage as number | undefined) ?? 1,
  );
  const [reach, setReach] = useState<number>(
    (data.reach as number | undefined) ?? 18,
  );
  const [boxHeight, setBoxHeight] = useState<number>(
    (data.boxHeight as number | undefined) ?? 16,
  );
  // Hitbox placement mode. Migrates the old `omnidirectional` boolean:
  // true -> "omni", false/unset -> "facing".
  const [hitboxMode, setHitboxMode] = useState<HitboxMode>(
    (data.hitboxMode as HitboxMode | undefined) ??
      (data.omnidirectional ? "omni" : "facing"),
  );
  const [targetTags, setTargetTags] = useState<string[]>(
    (data.targetTags as string[] | undefined) ?? ["enemy"],
  );
  const targetTagsKey = targetTags.join(",");
  const [emitEvent, setEmitEvent] = useState<string>(
    (data.emitEvent as string | undefined) ?? "player-attacked",
  );

  useEffect(() => {
    if (actors.length === 0) return;

    // Each actor needs its own HitboxComponent (kept inactive between
    // attacks). Keep a per-actor record of the active swing's timer so
    // multiple actors with this modifier coexist cleanly.
    const swingTimers = new Map<number, ReturnType<typeof setTimeout>>();
    // A box of length `reach` × width `boxHeight`, placed in front of the
    // actor along the given unit direction (snapped to the dominant axis).
    const forwardBox = (fx: number, fy: number): BoxShape[] => {
      if (Math.abs(fx) >= Math.abs(fy)) {
        const x = fx >= 0 ? 0 : -reach;
        return [{ x, y: -boxHeight / 2, w: reach, h: boxHeight }];
      }
      const y = fy >= 0 ? 0 : -reach;
      return [{ x: -boxHeight / 2, y, w: boxHeight, h: reach }];
    };
    const headingDir = (a: any): { x: number; y: number } | undefined => {
      const h = a.get?.(RequestedHeadingComponent)?.heading;
      return h && (h.x !== 0 || h.y !== 0) ? { x: h.x, y: h.y } : undefined;
    };
    const nearestTargetDir = (a: any): { x: number; y: number } | undefined => {
      const scene = a.scene;
      if (!scene) return undefined;
      let best: any;
      let bestD2 = Infinity;
      for (const o of scene.actors) {
        if (o === a) continue;
        if (!targetTags.some((t) => o.hasTag?.(t))) continue;
        const dx = o.pos.x - a.pos.x;
        const dy = o.pos.y - a.pos.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) {
          bestD2 = d2;
          best = o;
        }
      }
      if (!best) return undefined;
      return { x: best.pos.x - a.pos.x, y: best.pos.y - a.pos.y };
    };
    // The unit direction the swing points, per mode. Null for "omni" (no
    // direction → radial knockback). forwardBox({±1,0}) reproduces the old
    // "facing" box exactly, so all directional modes share one path.
    const swingDir = (a: any): { x: number; y: number } | null => {
      if (hitboxMode === "omni") return null;
      if (hitboxMode === "direction") {
        return getActorFacing(a) ?? headingDir(a) ?? { x: 0, y: 1 };
      }
      if (hitboxMode === "target") {
        return (
          nearestTargetDir(a) ?? getActorFacing(a) ?? headingDir(a) ?? { x: 0, y: 1 }
        );
      }
      // "facing": platformer left/right via graphics flip.
      const flipped = !!a.graphics?.flipHorizontal;
      return { x: flipped ? -1 : 1, y: 0 };
    };
    const setSwingShapes = (a: any): BoxShape[] => {
      const f = swingDir(a);
      if (!f) {
        // Square centered on the actor — covers all four directions.
        return [{ x: -reach, y: -reach, w: reach * 2, h: reach * 2 }];
      }
      return forwardBox(f.x, f.y);
    };

    const beginSwing = (a: any) => {
      const existing = a.get(HitboxComponent);
      const shapes = setSwingShapes(a);
      // Stamp the swing direction so HitboxSystem can knock the victim back
      // along the attack, not just radially.
      const f = swingDir(a);
      let dirX = 0;
      let dirY = 0;
      if (f) {
        const len = Math.hypot(f.x, f.y) || 1;
        dirX = f.x / len;
        dirY = f.y / len;
      }
      const hbc =
        existing ?? new HitboxComponent(shapes, damage, targetTags, true);
      if (existing) {
        existing.shapes = shapes;
        existing.damage = damage;
        existing.targetTags = targetTags;
        existing.active = true;
      } else {
        a.addComponent(hbc);
      }
      hbc.dirX = dirX;
      hbc.dirY = dirY;
      const anim = a.get(AnimationComponent);
      if (anim) anim.pin("attack", durationMs);
      if (emitEvent.trim()) emit(emitEvent.trim(), { actor: a });
      const prev = swingTimers.get(a.id);
      if (prev) clearTimeout(prev);
      swingTimers.set(
        a.id,
        setTimeout(() => {
          const h = a.get(HitboxComponent);
          if (h) h.active = false;
          swingTimers.delete(a.id);
        }, durationMs),
      );
    };

    // Drive via a key listener so events fire on the user-gesture call
    // stack — this also helps unlock the WebAudio context.
    const keyName = attackKey;
    const keyHandler = (e: KeyboardEvent) => {
      // Match Excalibur Keys by event.code where possible. Keys values are
      // already strings like "KeyX" so a direct compare works.
      if (e.code !== String(keyName) && e.key !== String(keyName)) return;
      for (const a of actors) {
        const chart = a.get(StateChartComponent);
        if (chart && NO_ATTACK_STATE.test(chart.current)) continue;
        beginSwing(a);
      }
    };
    window.addEventListener("keydown", keyHandler);
    return () => {
      window.removeEventListener("keydown", keyHandler);
      for (const t of swingTimers.values()) clearTimeout(t);
      for (const a of actors) {
        if (a.get(HitboxComponent)) a.removeComponent(HitboxComponent);
      }
    };
  }, [
    actorsKey,
    attackKey,
    durationMs,
    damage,
    reach,
    boxHeight,
    hitboxMode,
    targetTagsKey,
    emitEvent,
  ]);

  return (
    <ModShell
      id={id}
      data={data}
      accent="var(--accent-collision)"
      title="Attack"
      summary={`${String(attackKey).replace(/^Key/, "")} → ${damage} dmg`}
    >
        <Field label="key">
          <select
            className="nrpg-select"
            value={String(attackKey)}
            onChange={(e) => setAttackKey(e.currentTarget.value as Keys)}
          >
            {KEY_OPTIONS.map((opt) => (
              <option key={String(opt.value)} value={String(opt.value)}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="duration (ms)">
          <input
            type="number"
            min={50}
            className="nrpg-input"
            value={durationMs}
            onChange={(e) => setDurationMs(+e.currentTarget.value)}
          />
        </Field>
        <Field label="damage">
          <input
            type="number"
            min={0}
            className="nrpg-input"
            value={damage}
            onChange={(e) => setDamage(+e.currentTarget.value)}
          />
        </Field>
        <Field label="reach">
          <input
            type="number"
            min={1}
            className="nrpg-input"
            value={reach}
            onChange={(e) => setReach(+e.currentTarget.value)}
          />
        </Field>
        {hitboxMode !== "omni" && (
          <Field label="height">
            <input
              type="number"
              min={1}
              className="nrpg-input"
              value={boxHeight}
              onChange={(e) => setBoxHeight(+e.currentTarget.value)}
            />
          </Field>
        )}
        <Field label="hitbox">
          <select
            className="nrpg-select"
            value={hitboxMode}
            onChange={(e) => setHitboxMode(e.currentTarget.value as HitboxMode)}
          >
            {HITBOX_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        <Field label="target tags">
          <TagsField
            value={targetTags}
            onChange={setTargetTags}
            width={120}
            placeholder="enemy"
          />
        </Field>
        <Field label="emit event">
          <input
            type="text"
            className="nrpg-input"
            style={{ width: 120, textAlign: "left" }}
            value={emitEvent}
            placeholder="player-attacked"
            onChange={(e) => setEmitEvent(e.currentTarget.value)}
          />
        </Field>
    </ModShell>
  );
}
