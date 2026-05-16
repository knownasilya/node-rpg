import { NodeProps } from "@xyflow/react";
import { useEffect, useState } from "preact/hooks";
import { Button, Field } from "../../ui";
import {
  type BoxShape,
  HealthComponent,
  HurtboxComponent,
} from "./ecs";
import { parseTags, tagsToString, useParentActor } from "./shared";

function defaultBox(): BoxShape {
  return { x: -10, y: -10, w: 20, h: 20 };
}

export default function HurtboxModifier({ data, parentId }: NodeProps) {
  const actor = useParentActor(parentId);
  const [shapes, setShapes] = useState<BoxShape[]>(
    (data.shapes as BoxShape[] | undefined) ?? [defaultBox()],
  );
  const [tagsText, setTagsText] = useState<string>(
    tagsToString((data.tags as string[] | undefined) ?? ["player"]),
  );
  const [iFrameMs, setIFrameMs] = useState<number>(
    (data.iFrameMs as number | undefined) ?? 300,
  );

  const shapesKey = JSON.stringify(shapes);

  useEffect(() => {
    if (!actor) return;
    const tags = parseTags(tagsText);
    const existing = actor.get(HurtboxComponent);
    if (existing) {
      existing.shapes = shapes;
      existing.tags = tags;
      existing.iFrameMs = iFrameMs;
    } else {
      actor.addComponent(new HurtboxComponent(shapes, tags, iFrameMs));
    }
    // Auto-attach a default HealthComponent if no Health modifier did first;
    // HitboxSystem expects health to decrement on hit.
    if (!actor.get(HealthComponent)) {
      actor.addComponent(new HealthComponent(3, "kill"));
    }
    return () => {
      if (actor.get(HurtboxComponent)) {
        actor.removeComponent(HurtboxComponent);
      }
    };
  }, [actor, shapesKey, tagsText, iFrameMs]);

  const updateShape = (i: number, patch: Partial<BoxShape>) =>
    setShapes((arr) => arr.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const removeShape = (i: number) =>
    setShapes((arr) => arr.filter((_, idx) => idx !== i));

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
        Hurtbox
      </div>
      <div className="nrpg-mod-body nodrag">
        <Field label="tags">
          <input
            type="text"
            className="nrpg-input"
            style={{ width: 120, textAlign: "left" }}
            value={tagsText}
            placeholder="player"
            onChange={(e) => setTagsText(e.currentTarget.value)}
          />
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
      </div>
    </div>
  );
}
