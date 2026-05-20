import { NodeProps, useNodes, useReactFlow } from "@xyflow/react";
import { useEffect, useState } from "preact/hooks";
import { Field, ModShell } from "../../ui";
import { HealthComponent } from "./ecs";
import { getSpritesheet, useAssetVersion, useParentActors } from "./shared";

// HealthSprite: swap the actor's graphic between three spritesheet frames
// (good / damaged / broken) based on its HealthComponent fraction. Used for a
// tower-defense base/tower that visibly degrades as it takes hits.

export default function HealthSpriteModifier({ id, data, parentId }: NodeProps) {
  const reactFlow = useReactFlow();
  const actors = useParentActors(parentId);
  const actorsKey = actors.map((a) => a.id).join(",");
  const allNodes = useNodes();
  const sheetNodes = allNodes.filter((n) => n.type === "spritesheet");
  const assetVersion = useAssetVersion();

  const [sheet, setSheet] = useState<string>(
    (data.spritesheetNodeId as string | undefined) ?? "",
  );
  const [goodFrame, setGoodFrame] = useState<number>(
    (data.goodFrame as number | undefined) ?? 0,
  );
  const [damagedFrame, setDamagedFrame] = useState<number>(
    (data.damagedFrame as number | undefined) ?? 1,
  );
  const [brokenFrame, setBrokenFrame] = useState<number>(
    (data.brokenFrame as number | undefined) ?? 2,
  );
  const [damagedBelow, setDamagedBelow] = useState<number>(
    (data.damagedBelow as number | undefined) ?? 0.66,
  );
  const [brokenBelow, setBrokenBelow] = useState<number>(
    (data.brokenBelow as number | undefined) ?? 0.33,
  );
  const update = (patch: Record<string, unknown>) =>
    reactFlow.updateNodeData(id, patch);

  useEffect(() => {
    if (actors.length === 0 || !sheet) return;
    const applied = new Map<number, number>();
    const intv = setInterval(() => {
      const ss = getSpritesheet(sheet);
      if (!ss) return;
      for (const a of actors) {
        const hp = a.get(HealthComponent);
        if (!hp) continue;
        const frac = hp.max > 0 ? hp.current / hp.max : 0;
        const frame =
          frac > damagedBelow ? goodFrame : frac > brokenBelow ? damagedFrame : brokenFrame;
        if (applied.get(a.id) === frame) continue;
        const sprite = ss.sprites[frame];
        if (!sprite) continue;
        try {
          (a as any).graphics.use(sprite);
          applied.set(a.id, frame);
        } catch {}
      }
    }, 1000 / 15);
    return () => clearInterval(intv);
  }, [actorsKey, sheet, goodFrame, damagedFrame, brokenFrame, damagedBelow, brokenBelow, assetVersion]);

  return (
    <ModShell
      id={id}
      data={data}
      accent="var(--accent-entity)"
      title="Health Sprite"
      summary={`good/dmg/broken`}
    >
      <Field label="sheet">
        <select className="nrpg-select" value={sheet}
          onChange={(e) => { setSheet(e.currentTarget.value); update({ spritesheetNodeId: e.currentTarget.value }); }}>
          <option value="">(none)</option>
          {sheetNodes.map((n) => (
            <option key={n.id} value={n.id}>
              {((n.data?.label as string | undefined) ?? n.id) + ` — ${n.id}`}
            </option>
          ))}
        </select>
      </Field>
      <Field label="good frame">
        <input type="number" min={0} className="nrpg-input" value={goodFrame}
          onChange={(e) => { setGoodFrame(+e.currentTarget.value); update({ goodFrame: +e.currentTarget.value }); }} />
      </Field>
      <Field label="damaged frame">
        <input type="number" min={0} className="nrpg-input" value={damagedFrame}
          onChange={(e) => { setDamagedFrame(+e.currentTarget.value); update({ damagedFrame: +e.currentTarget.value }); }} />
      </Field>
      <Field label="broken frame">
        <input type="number" min={0} className="nrpg-input" value={brokenFrame}
          onChange={(e) => { setBrokenFrame(+e.currentTarget.value); update({ brokenFrame: +e.currentTarget.value }); }} />
      </Field>
      <Field label="damaged below">
        <input type="number" step={0.05} className="nrpg-input" value={damagedBelow}
          onChange={(e) => { setDamagedBelow(+e.currentTarget.value); update({ damagedBelow: +e.currentTarget.value }); }} />
      </Field>
      <Field label="broken below">
        <input type="number" step={0.05} className="nrpg-input" value={brokenBelow}
          onChange={(e) => { setBrokenBelow(+e.currentTarget.value); update({ brokenBelow: +e.currentTarget.value }); }} />
      </Field>
    </ModShell>
  );
}
