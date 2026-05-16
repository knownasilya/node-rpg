import { NodeProps } from "@xyflow/react";
import { Keys } from "excalibur";
import { useEffect, useState } from "preact/hooks";
import { Field, ModShell } from "../../ui";
import { GroundedComponent, JumpComponent } from "./ecs";
import { useParentActor } from "./shared";

const KEY_OPTIONS: { label: string; value: Keys }[] = [
  { label: "Space", value: Keys.Space },
  { label: "W", value: Keys.W },
  { label: "Up", value: Keys.Up },
  { label: "Z", value: Keys.Z },
  { label: "K", value: Keys.K },
];

export default function JumpModifier({ id, data, parentId }: NodeProps) {
  const actor = useParentActor(parentId);
  const [jumpVelocity, setJumpVelocity] = useState<number>(
    (data.jumpVelocity as number | undefined) ?? 520,
  );
  const [variableHeightCutoff, setVariableHeightCutoff] = useState<number>(
    (data.variableHeightCutoff as number | undefined) ?? 180,
  );
  const [coyoteMs, setCoyoteMs] = useState<number>(
    (data.coyoteMs as number | undefined) ?? 100,
  );
  const [bufferMs, setBufferMs] = useState<number>(
    (data.bufferMs as number | undefined) ?? 120,
  );
  const [maxJumps, setMaxJumps] = useState<number>(
    (data.maxJumps as number | undefined) ?? 1,
  );
  const [jumpKey, setJumpKey] = useState<Keys>(
    (data.jumpKey as Keys | undefined) ?? Keys.Space,
  );
  const [emitTag, setEmitTag] = useState<string>(
    (data.emitTag as string | undefined) ?? "",
  );

  useEffect(() => {
    if (!actor) return;
    // JumpSystem needs a GroundedComponent to enforce ground-conditional
    // logic; auto-attach a default one if no Ground modifier did.
    if (!actor.get(GroundedComponent)) {
      actor.addComponent(new GroundedComponent());
    }
    const existing = actor.get(JumpComponent);
    if (existing) {
      existing.jumpVelocity = jumpVelocity;
      existing.variableHeightCutoff = variableHeightCutoff;
      existing.coyoteMs = coyoteMs;
      existing.bufferMs = bufferMs;
      existing.maxJumps = maxJumps;
      existing.jumpKey = jumpKey;
      existing.emitTag = emitTag.trim() || undefined;
    } else {
      const jc = new JumpComponent(
        jumpVelocity,
        variableHeightCutoff,
        coyoteMs,
        bufferMs,
        maxJumps,
        jumpKey,
      );
      jc.emitTag = emitTag.trim() || undefined;
      actor.addComponent(jc);
    }
    return () => {
      if (actor.get(JumpComponent)) {
        actor.removeComponent(JumpComponent);
      }
    };
  }, [
    actor,
    jumpVelocity,
    variableHeightCutoff,
    coyoteMs,
    bufferMs,
    maxJumps,
    jumpKey,
    emitTag,
  ]);

  return (
    <ModShell
      id={id}
      data={data}
      accent="var(--accent-movement)"
      title="Jump"
      summary={`${String(jumpKey).replace(/^Key/, "")} • v ${jumpVelocity}`}
    >
        <Field label="key">
          <select
            className="nrpg-select"
            value={String(jumpKey)}
            onChange={(e) =>
              setJumpKey(e.currentTarget.value as Keys)
            }
          >
            {KEY_OPTIONS.map((opt) => (
              <option key={String(opt.value)} value={String(opt.value)}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="velocity">
          <input
            type="number"
            className="nrpg-input"
            value={jumpVelocity}
            onChange={(e) => setJumpVelocity(+e.currentTarget.value)}
          />
        </Field>
        <Field label="cutoff">
          <input
            type="number"
            className="nrpg-input"
            value={variableHeightCutoff}
            onChange={(e) =>
              setVariableHeightCutoff(+e.currentTarget.value)
            }
          />
        </Field>
        <Field label="coyote (ms)">
          <input
            type="number"
            className="nrpg-input"
            value={coyoteMs}
            onChange={(e) => setCoyoteMs(+e.currentTarget.value)}
          />
        </Field>
        <Field label="buffer (ms)">
          <input
            type="number"
            className="nrpg-input"
            value={bufferMs}
            onChange={(e) => setBufferMs(+e.currentTarget.value)}
          />
        </Field>
        <Field label="max jumps">
          <input
            type="number"
            className="nrpg-input"
            min={1}
            value={maxJumps}
            onChange={(e) => setMaxJumps(+e.currentTarget.value)}
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
