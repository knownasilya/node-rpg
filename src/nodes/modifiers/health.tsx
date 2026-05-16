import { NodeProps } from "@xyflow/react";
import { useEffect, useState } from "preact/hooks";
import { Field } from "../../ui";
import { HealthComponent, type OnZero } from "./ecs";
import { useParentActor } from "./shared";

const ON_ZERO_OPTIONS: OnZero[] = ["kill", "respawn", "emit"];

export default function HealthModifier({ data, parentId }: NodeProps) {
  const actor = useParentActor(parentId);
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
    if (!actor) return;
    const existing = actor.get(HealthComponent);
    if (existing) {
      existing.max = max;
      existing.onZero = onZero;
      existing.emitEvent = emitEvent.trim() || undefined;
      // Don't yank current downward — only raise the floor if max went up.
      if (existing.current > max) existing.current = max;
    } else {
      actor.addComponent(
        new HealthComponent(max, onZero, emitEvent.trim() || undefined),
      );
    }
    return () => {
      // Health is shared infrastructure between Hurtbox & this modifier; only
      // remove if the user explicitly unmounts the Health modifier and no
      // Hurtbox sibling is keeping it alive. We do a soft check here.
      const stillNeeded = !!actor.get(HealthComponent);
      if (stillNeeded && !actor.get(HealthComponent)?.current) {
        actor.removeComponent(HealthComponent);
      }
    };
  }, [actor, max, onZero, emitEvent]);

  return (
    <div
      className="nrpg-mod"
      style={{ ["--accent" as any]: "var(--accent-collision)" }}
    >
      <div className="nrpg-mod-accent" />
      <div className="nrpg-mod-header">
        <span
          className="nrpg-header-dot"
          style={{ background: "var(--accent-collision)" }}
        />
        Health
      </div>
      <div className="nrpg-mod-body nodrag">
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
      </div>
    </div>
  );
}
