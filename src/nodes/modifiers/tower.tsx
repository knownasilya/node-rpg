import { NodeProps } from "@xyflow/react";
import { useEffect, useState } from "preact/hooks";
import { Field, ModShell } from "../../ui";
import { useParentActors } from "./shared";
import { fireTower } from "./towerCore";

// Tower (tower-defense turret): every `cooldownMs`, pick the nearest actor
// tagged `targetTag` within `range` and deal `damage` to its HealthComponent.
// When a target dies it's removed and `killEvent` is emitted (for score). A
// small projectile dot flies from the tower to the target for visual feedback.

export default function TowerModifier({ id, data, parentId }: NodeProps) {
  const actors = useParentActors(parentId);
  const actorsKey = actors.map((a) => a.id).join(",");
  const [range, setRange] = useState<number>(
    (data.range as number | undefined) ?? 70,
  );
  const [damage, setDamage] = useState<number>(
    (data.damage as number | undefined) ?? 1,
  );
  const [cooldownMs, setCooldownMs] = useState<number>(
    (data.cooldownMs as number | undefined) ?? 700,
  );
  const [targetTag, setTargetTag] = useState<string>(
    (data.targetTag as string | undefined) ?? "enemy",
  );
  const [killEvent, setKillEvent] = useState<string>(
    (data.killEvent as string | undefined) ?? "enemy-killed",
  );

  useEffect(() => {
    if (actors.length === 0) return;
    const last = new Map<number, number>();
    const cfg = { range, damage, cooldownMs, targetTag, killEvent };
    const intv = setInterval(() => {
      const now = performance.now();
      for (const tower of actors) fireTower(tower, cfg, last, now);
    }, 1000 / 30);
    return () => clearInterval(intv);
  }, [actorsKey, range, damage, cooldownMs, targetTag, killEvent]);

  return (
    <ModShell
      id={id}
      data={data}
      accent="var(--accent-collision)"
      title="Tower"
      summary={`${damage}dmg / ${range}px`}
    >
      <Field label="range">
        <input type="number" min={1} className="nrpg-input" value={range}
          onChange={(e) => setRange(+e.currentTarget.value)} />
      </Field>
      <Field label="damage">
        <input type="number" min={0} className="nrpg-input" value={damage}
          onChange={(e) => setDamage(+e.currentTarget.value)} />
      </Field>
      <Field label="cooldown (ms)">
        <input type="number" min={50} className="nrpg-input" value={cooldownMs}
          onChange={(e) => setCooldownMs(+e.currentTarget.value)} />
      </Field>
      <Field label="target tag">
        <input type="text" className="nrpg-input" style={{ width: 120, textAlign: "left" }}
          value={targetTag} onChange={(e) => setTargetTag(e.currentTarget.value)} />
      </Field>
      <Field label="kill event">
        <input type="text" className="nrpg-input" style={{ width: 120, textAlign: "left" }}
          value={killEvent} onChange={(e) => setKillEvent(e.currentTarget.value)} />
      </Field>
    </ModShell>
  );
}
