import { NodeProps } from "@xyflow/react";
import { useEffect, useState } from "preact/hooks";
import { Field } from "../../ui";
import { GroundedComponent } from "./ecs";
import { parseTags, tagsToString, useParentActor } from "./shared";

export default function GroundModifier({ data, parentId }: NodeProps) {
  const actor = useParentActor(parentId);
  const [solidTagsText, setSolidTagsText] = useState<string>(
    tagsToString(
      (data.solidTags as string[] | undefined) ?? ["solid", "one-way-platform"],
    ),
  );
  const [emitTag, setEmitTag] = useState<string>(
    (data.emitTag as string | undefined) ?? "",
  );

  useEffect(() => {
    if (!actor) return;
    const tags = parseTags(solidTagsText);
    const existing = actor.get(GroundedComponent);
    if (existing) {
      existing.solidTags = tags;
      existing.emitTag = emitTag.trim() || undefined;
    } else {
      const gc = new GroundedComponent(tags);
      gc.emitTag = emitTag.trim() || undefined;
      actor.addComponent(gc);
    }
    return () => {
      if (actor.get(GroundedComponent)) {
        actor.removeComponent(GroundedComponent);
      }
    };
  }, [actor, solidTagsText, emitTag]);

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
        Ground
      </div>
      <div className="nrpg-mod-body nodrag">
        <Field label="solid tags">
          <input
            type="text"
            className="nrpg-input"
            style={{ width: 110, textAlign: "left" }}
            value={solidTagsText}
            placeholder="solid, one-way-platform"
            onChange={(e) => setSolidTagsText(e.currentTarget.value)}
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
      </div>
    </div>
  );
}
