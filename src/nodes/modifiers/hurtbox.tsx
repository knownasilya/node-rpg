import { NodeProps } from "@xyflow/react";
import { useEffect, useState } from "preact/hooks";
import { Button, Field, ModShell, TagsField } from "../../ui";
import {
  type BoxShape,
  HealthComponent,
  HurtboxComponent,
} from "./ecs";
import { useParentActors } from "./shared";

function defaultBox(): BoxShape {
  return { x: -10, y: -10, w: 20, h: 20 };
}

export default function HurtboxModifier({ id, data, parentId }: NodeProps) {
  const actors = useParentActors(parentId);
  const actorsKey = actors.map((a) => a.id).join(",");
  const [shapes, setShapes] = useState<BoxShape[]>(
    (data.shapes as BoxShape[] | undefined) ?? [defaultBox()],
  );
  const [tags, setTags] = useState<string[]>(
    (data.tags as string[] | undefined) ?? ["player"],
  );
  const tagsKey = tags.join(",");
  const [iFrameMs, setIFrameMs] = useState<number>(
    (data.iFrameMs as number | undefined) ?? 300,
  );
  // Knockback: how hard (px/s) the owner is pushed away from an attacker when
  // hit, and for how long. 0 = none (default).
  const [knockback, setKnockback] = useState<number>(
    (data.knockback as number | undefined) ?? 0,
  );
  const [knockbackMs, setKnockbackMs] = useState<number>(
    (data.knockbackMs as number | undefined) ?? 150,
  );

  const shapesKey = JSON.stringify(shapes);

  useEffect(() => {
    if (actors.length === 0) return;
    for (const actor of actors) {
      const existing = actor.get(HurtboxComponent);
      if (existing) {
        existing.shapes = shapes;
        existing.tags = tags;
        existing.iFrameMs = iFrameMs;
        existing.knockback = knockback;
        existing.knockbackMs = knockbackMs;
      } else {
        actor.addComponent(
          new HurtboxComponent(shapes, tags, iFrameMs, knockback, knockbackMs),
        );
      }
      if (!actor.get(HealthComponent)) {
        actor.addComponent(new HealthComponent(3, "kill"));
      }
    }
    return () => {
      for (const actor of actors) {
        if (actor.get(HurtboxComponent)) {
          actor.removeComponent(HurtboxComponent);
        }
      }
    };
  }, [actorsKey, shapesKey, tagsKey, iFrameMs, knockback, knockbackMs]);

  const updateShape = (i: number, patch: Partial<BoxShape>) =>
    setShapes((arr) => arr.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const removeShape = (i: number) =>
    setShapes((arr) => arr.filter((_, idx) => idx !== i));

  return (
    <ModShell
      id={id}
      data={data}
      accent="var(--accent-collision)"
      title="Hurtbox"
      summary={`${tags.join(",") || "?"} • ${iFrameMs}ms`}
    >
        <Field label="tags">
          <TagsField value={tags} onChange={setTags} width={120} placeholder="player" />
        </Field>
        <Field label="i-frames (ms)">
          <input
            type="number"
            min={0}
            className="nrpg-input"
            value={iFrameMs}
            onChange={(e) => setIFrameMs(+e.currentTarget.value)}
          />
        </Field>
        <Field label="knockback (px/s)">
          <input
            type="number"
            min={0}
            className="nrpg-input"
            value={knockback}
            title="How hard the owner is pushed away when hit. 0 = none."
            onChange={(e) => setKnockback(+e.currentTarget.value)}
          />
        </Field>
        {knockback > 0 && (
          <Field label="knockback (ms)">
            <input
              type="number"
              min={0}
              className="nrpg-input"
              value={knockbackMs}
              onChange={(e) => setKnockbackMs(+e.currentTarget.value)}
            />
          </Field>
        )}
        <div style={{ fontSize: 10, color: "var(--text-subtle)" }}>
          shapes (offset from actor center)
        </div>
        {shapes.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input
              type="number"
              className="nrpg-input"
              style={{ width: 36 }}
              value={s.x}
              title="x"
              onChange={(e) => updateShape(i, { x: +e.currentTarget.value })}
            />
            <input
              type="number"
              className="nrpg-input"
              style={{ width: 36 }}
              value={s.y}
              title="y"
              onChange={(e) => updateShape(i, { y: +e.currentTarget.value })}
            />
            <input
              type="number"
              className="nrpg-input"
              style={{ width: 36 }}
              value={s.w}
              title="w"
              onChange={(e) => updateShape(i, { w: +e.currentTarget.value })}
            />
            <input
              type="number"
              className="nrpg-input"
              style={{ width: 36 }}
              value={s.h}
              title="h"
              onChange={(e) => updateShape(i, { h: +e.currentTarget.value })}
            />
            <Button
              variant="danger"
              className="icon"
              onClick={() => removeShape(i)}
              title="Remove"
            >
              ✕
            </Button>
          </div>
        ))}
        <Button onClick={() => setShapes((s) => [...s, defaultBox()])}>
          + box
        </Button>
    </ModShell>
  );
}
