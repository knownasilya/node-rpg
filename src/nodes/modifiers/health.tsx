import { NodeProps } from "@xyflow/react";
import { useEffect, useState } from "preact/hooks";
import { Field, ModShell } from "../../ui";
import { HealthComponent, type OnZero } from "./ecs";
import { useParentActors } from "./shared";

const ON_ZERO_OPTIONS: OnZero[] = ["kill", "respawn", "emit"];

export default function HealthModifier({ id, data, parentId }: NodeProps) {
  const actors = useParentActors(parentId);
  const actorsKey = actors.map((a) => a.id).join(",");
  const [max, setMax] = useState<number>(
    (data.max as number | undefined) ?? 3,
  );
  const [onZero, setOnZero] = useState<OnZero>(
    (data.onZero as OnZero | undefined) ?? "kill",
  );
  const [emitEvent, setEmitEvent] = useState<string>(
    (data.emitEvent as string | undefined) ?? "",
  );

  useEffect(() => {
    if (actors.length === 0) return;
    for (const actor of actors) {
      const existing = actor.get(HealthComponent);
      if (existing) {
        existing.max = max;
        existing.onZero = onZero;
        existing.emitEvent = emitEvent.trim() || undefined;
        if (existing.current > max) existing.current = max;
      } else {
        actor.addComponent(
          new HealthComponent(max, onZero, emitEvent.trim() || undefined),
        );
      }
    }
    // No removal on unmount — the HurtboxSystem and Hurtbox modifier may
    // still rely on the component. Health acts as a passive store.
  }, [actorsKey, max, onZero, emitEvent]);

  return (
    <ModShell
      id={id}
      data={data}
      accent="var(--accent-collision)"
      title="Health"
      summary={`${max} hp → ${onZero}${onZero === "emit" && emitEvent ? ` "${emitEvent}"` : ""}`}
    >
        <Field label="max">
          <input
            type="number"
            min={1}
            className="nrpg-input"
            value={max}
            onChange={(e) => setMax(+e.currentTarget.value)}
          />
        </Field>
        <Field label="on zero">
          <select
            className="nrpg-select"
            value={onZero}
            onChange={(e) => setOnZero(e.currentTarget.value as OnZero)}
          >
            {ON_ZERO_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>
        {onZero === "emit" && (
          <Field label="event">
            <input
              type="text"
              className="nrpg-input"
              style={{ width: 120, textAlign: "left" }}
              value={emitEvent}
              placeholder="e.g. player-died"
              onChange={(e) => setEmitEvent(e.currentTarget.value)}
            />
          </Field>
        )}
    </ModShell>
  );
}
