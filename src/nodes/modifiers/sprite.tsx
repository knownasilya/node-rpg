import { NodeProps, useNodes, useReactFlow } from "@xyflow/react";
import { useEffect, useState } from "preact/hooks";
import { Field, ModShell } from "../../ui";
import {
  getImage,
  getSpritesheet,
  useAssetVersion,
  useParentActor,
} from "./shared";

// Static sprite: swap the actor's default graphic for a Sprite drawn from
// an Image (whole image) or a Spritesheet frame. Pure side effect into
// `actor.graphics.use(...)` — no Component is attached, since the data is
// editor-state, not gameplay-state.

export default function SpriteModifier({ id, data, parentId }: NodeProps) {
  const actor = useParentActor(parentId);
  const reactFlow = useReactFlow();
  const allNodes = useNodes();
  const imageNodes = allNodes.filter((n) => n.type === "image");
  const sheetNodes = allNodes.filter((n) => n.type === "spritesheet");

  const [imageNodeId, setImageNodeId] = useState<string>(
    (data.imageNodeId as string | undefined) ?? "",
  );
  const [spritesheetNodeId, setSpritesheetNodeId] = useState<string>(
    (data.spritesheetNodeId as string | undefined) ?? "",
  );
  const [frameIndex, setFrameIndex] = useState<number>(
    (data.frameIndex as number | undefined) ?? 0,
  );
  const assetVersion = useAssetVersion();

  useEffect(() => {
    if (!actor) return;
    let cancelled = false;
    const apply = async () => {
      if (spritesheetNodeId) {
        const sheet = getSpritesheet(spritesheetNodeId);
        if (!sheet) return;
        const sprite = sheet.sprites[frameIndex];
        if (cancelled || !sprite) return;
        actor.graphics.use(sprite);
        return;
      }
      if (imageNodeId) {
        const image = getImage(imageNodeId);
        if (!image) return;
        try {
          if (!image.isLoaded()) await image.load();
        } catch {
          return;
        }
        if (cancelled) return;
        actor.graphics.use(image.toSprite());
      }
    };
    apply();
    return () => {
      cancelled = true;
    };
  }, [actor, imageNodeId, spritesheetNodeId, frameIndex, assetVersion]);

  const summary = spritesheetNodeId
    ? `${spritesheetNodeId} • ${frameIndex}`
    : imageNodeId || "(none)";
  return (
    <ModShell
      id={id}
      data={data}
      accent="var(--accent-entity)"
      title="Sprite"
      summary={summary}
    >
        <Field label="image">
          <select
            className="nrpg-select"
            value={imageNodeId}
            onChange={(e) => {
              const v = e.currentTarget.value;
              setImageNodeId(v);
              reactFlow.updateNodeData(
                (data as any).__nodeId ?? "",
                { imageNodeId: v },
              );
            }}
          >
            <option value="">(none)</option>
            {imageNodes.map((n) => (
              <option key={n.id} value={n.id}>
                {((n.data?.label as string | undefined) ?? n.id) +
                  ` — ${n.id}`}
              </option>
            ))}
          </select>
        </Field>
        <Field label="sheet">
          <select
            className="nrpg-select"
            value={spritesheetNodeId}
            onChange={(e) => {
              const v = e.currentTarget.value;
              setSpritesheetNodeId(v);
            }}
          >
            <option value="">(none — use image)</option>
            {sheetNodes.map((n) => (
              <option key={n.id} value={n.id}>
                {((n.data?.label as string | undefined) ?? n.id) +
                  ` — ${n.id}`}
              </option>
            ))}
          </select>
        </Field>
        {spritesheetNodeId && (
          <Field label="frame">
            <input
              type="number"
              min={0}
              className="nrpg-input"
              value={frameIndex}
              onChange={(e) => setFrameIndex(+e.currentTarget.value)}
            />
          </Field>
        )}
    </ModShell>
  );
}
