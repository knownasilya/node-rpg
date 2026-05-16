import { NodeProps } from "@xyflow/react";
import { useEffect, useState } from "preact/hooks";
import { Button, Field, ModShell, TagsField, Toggle } from "../../ui";
import { type BoxShape, HitboxComponent } from "./ecs";
import { useParentActors } from "./shared";

function defaultBox(): BoxShape {
  return { x: -8, y: -8, w: 16, h: 16 };
}

export default function HitboxModifier({ id, data, parentId }: NodeProps) {
  const actors = useParentActors(parentId);
  const actorsKey = actors.map((a) => a.id).join(",");
  const [shapes, setShapes] = useState<BoxShape[]>(
    (data.shapes as BoxShape[] | undefined) ?? [defaultBox()],
  );
  const [damage, setDamage] = useState<number>(
    (data.damage as number | undefined) ?? 1,
  );
  const [targetTags, setTargetTags] = useState<string[]>(
    (data.targetTags as string[] | undefined) ?? ["enemy"],
  );
  const [active, setActive] = useState<boolean>(
    (data.active as boolean | undefined) ?? true,
  );

  const shapesKey = JSON.stringify(shapes);
  const tagsKey = targetTags.join(",");

  useEffect(() => {
    if (actors.length === 0) return;
    for (const actor of actors) {
      const existing = actor.get(HitboxComponent);
      if (existing) {
        existing.shapes = shapes;
        existing.damage = damage;
        existing.targetTags = targetTags;
        existing.active = active;
      } else {
        actor.addComponent(
          new HitboxComponent(shapes, damage, targetTags, active),
        );
      }
    }
    return () => {
      for (const actor of actors) {
        if (actor.get(HitboxComponent)) {
          actor.removeComponent(HitboxComponent);
        }
      }
    };
  }, [actorsKey, shapesKey, damage, tagsKey, active]);

  const updateShape = (i: number, patch: Partial<BoxShape>) =>
    setShapes((arr) => arr.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const removeShape = (i: number) =>
    setShapes((arr) => arr.filter((_, idx) => idx !== i));

  return (
    <ModShell
      id={id}
      data={data}
      accent="var(--accent-collision)"
      title="Hitbox"
      summary={`${active ? "on" : "off"} • ${damage} dmg → ${targetTags.join(",") || "?"}`}
    >
        <Toggle label="active" checked={active} onChange={setActive} />
        <Field label="damage">
          <input
            type="number"
            min={0}
            className="nrpg-input"
            value={damage}
            onChange={(e) => setDamage(+e.currentTarget.value)}
          />
        </Field>
        <Field label="target tags">
          <TagsField
            value={targetTags}
            onChange={setTargetTags}
            width={120}
            placeholder="enemy"
          />
        </Field>
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
