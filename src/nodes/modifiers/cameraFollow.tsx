import { NodeProps } from "@xyflow/react";
import { vec } from "excalibur";
import { useEffect, useState } from "preact/hooks";
import { Field, ModShell, Toggle } from "../../ui";
import { CameraFollowComponent } from "./ecs";
import { useParentActor } from "./shared";

export default function CameraFollowModifier({ id, data, parentId }: NodeProps) {
  const actor = useParentActor(parentId);
  const [followX, setFollowX] = useState<boolean>(
    (data.followX as boolean | undefined) ?? true,
  );
  const [followY, setFollowY] = useState<boolean>(
    (data.followY as boolean | undefined) ?? true,
  );
  const [deadW, setDeadW] = useState<number>(
    (data.deadW as number | undefined) ?? 60,
  );
  const [deadH, setDeadH] = useState<number>(
    (data.deadH as number | undefined) ?? 40,
  );
  const [lerp, setLerp] = useState<number>(
    (data.lerp as number | undefined) ?? 0.12,
  );
  const [offsetX, setOffsetX] = useState<number>(
    (data.offsetX as number | undefined) ?? 0,
  );
  const [offsetY, setOffsetY] = useState<number>(
    (data.offsetY as number | undefined) ?? 0,
  );

  useEffect(() => {
    if (!actor) return;
    const existing = actor.get(CameraFollowComponent);
    if (existing) {
      existing.axes = { x: followX, y: followY };
      existing.deadzone = { w: deadW, h: deadH };
      existing.lerp = lerp;
      existing.offset = vec(offsetX, offsetY);
    } else {
      actor.addComponent(
        new CameraFollowComponent(
          { x: followX, y: followY },
          { w: deadW, h: deadH },
          lerp,
          vec(offsetX, offsetY),
        ),
      );
    }
    return () => {
      if (actor.get(CameraFollowComponent)) {
        actor.removeComponent(CameraFollowComponent);
      }
    };
  }, [actor, followX, followY, deadW, deadH, lerp, offsetX, offsetY]);

  const axes = `${followX ? "x" : ""}${followY ? "y" : ""}`;
  return (
    <ModShell
      id={id}
      data={data}
      accent="var(--accent-scene)"
      title="Camera"
      summary={`follow ${axes || "none"}`}
    >
        <Toggle label="follow x" checked={followX} onChange={setFollowX} />
        <Toggle label="follow y" checked={followY} onChange={setFollowY} />
        <Field label="dead w">
          <input
            type="number"
            className="nrpg-input"
            value={deadW}
            onChange={(e) => setDeadW(+e.currentTarget.value)}
          />
        </Field>
        <Field label="dead h">
          <input
            type="number"
            className="nrpg-input"
            value={deadH}
            onChange={(e) => setDeadH(+e.currentTarget.value)}
          />
        </Field>
        <Field label="lerp">
          <input
            type="number"
            step="0.01"
            min={0}
            max={1}
            className="nrpg-input"
            value={lerp}
            onChange={(e) => setLerp(+e.currentTarget.value)}
          />
        </Field>
        <Field label="offset x">
          <input
            type="number"
            className="nrpg-input"
            value={offsetX}
            onChange={(e) => setOffsetX(+e.currentTarget.value)}
          />
        </Field>
        <Field label="offset y">
          <input
            type="number"
            className="nrpg-input"
            value={offsetY}
            onChange={(e) => setOffsetY(+e.currentTarget.value)}
          />
        </Field>
    </ModShell>
  );
}
