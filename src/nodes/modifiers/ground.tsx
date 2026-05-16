import { NodeProps } from "@xyflow/react";
import { useEffect, useState } from "preact/hooks";
import { Field, ModShell, TagsField } from "../../ui";
import { GroundedComponent } from "./ecs";
import { useParentActor } from "./shared";

export default function GroundModifier({ id, data, parentId }: NodeProps) {
  const actor = useParentActor(parentId);
  const [solidTags, setSolidTags] = useState<string[]>(
    (data.solidTags as string[] | undefined) ?? ["solid", "one-way-platform"],
  );
  const [emitTag, setEmitTag] = useState<string>(
    (data.emitTag as string | undefined) ?? "",
  );
  const solidTagsKey = solidTags.join(",");

  useEffect(() => {
    if (!actor) return;
    const existing = actor.get(GroundedComponent);
    if (existing) {
      existing.solidTags = solidTags;
      existing.emitTag = emitTag.trim() || undefined;
    } else {
      const gc = new GroundedComponent(solidTags);
      gc.emitTag = emitTag.trim() || undefined;
      actor.addComponent(gc);
    }
    return () => {
      if (actor.get(GroundedComponent)) {
        actor.removeComponent(GroundedComponent);
      }
    };
  }, [actor, solidTagsKey, emitTag]);

  return (
    <ModShell
      id={id}
      data={data}
      accent="var(--accent-collision)"
      title="Ground"
      summary={solidTags.join(", ")}
    >
      <Field label="solid tags">
        <TagsField
          value={solidTags}
          onChange={setSolidTags}
          width={110}
          placeholder="solid"
        />
      </Field>
      <Field label="emit tag">
        <input
          type="text"
          className="nrpg-input"
          style={{ width: 110, textAlign: "left" }}
          value={emitTag}
          placeholder="e.g. player"
          onChange={(e) => setEmitTag(e.currentTarget.value)}
        />
      </Field>
    </ModShell>
  );
}
