import { NodeProps } from "@xyflow/react";
import { Keys } from "excalibur";
import { useEffect, useState } from "preact/hooks";
import { Field, ModShell, TagsField, Toggle } from "../../ui";
import {
  HitboxComponent,
  type BoxShape,
} from "./ecs";
import { emit, useParentActors } from "./shared";
import { PlayerAnimationStateComponent as AnimationComponent } from "./animation";

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
  // Top-down games want a swing that hits in every direction; platformers
  // want a facing-offset box. When on, the hitbox is a square centered on
  // the actor (side = 2*reach) and `height` is ignored.
  const [omnidirectional, setOmnidirectional] = useState<boolean>(
    (data.omnidirectional as boolean | undefined) ?? false,
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
    const setSwingShapes = (graphics: any): BoxShape[] => {
      if (omnidirectional) {
        // Square centered on the actor — covers all four directions.
        return [{ x: -reach, y: -reach, w: reach * 2, h: reach * 2 }];
      }
      const flipped = !!graphics?.flipHorizontal;
      const x = flipped ? -reach : 0;
      const y = -boxHeight / 2;
      return [{ x, y, w: reach, h: boxHeight }];
    };

    const beginSwing = (a: any) => {
      const existing = a.get(HitboxComponent);
      const graphics = a.graphics;
      const shapes = setSwingShapes(graphics);
      if (existing) {
        existing.shapes = shapes;
        existing.damage = damage;
        existing.targetTags = targetTags;
        existing.active = true;
      } else {
        a.addComponent(new HitboxComponent(shapes, damage, targetTags, true));
      }
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
      for (const a of actors) beginSwing(a);
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
    omnidirectional,
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
        {!omnidirectional && (
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
        <Toggle
          label="omnidirectional"
          checked={omnidirectional}
          onChange={setOmnidirectional}
        />
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
