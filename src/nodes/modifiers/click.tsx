import { NodeProps } from "@xyflow/react";
import { useEffect, useState } from "preact/hooks";
import { Field, ModShell } from "../../ui";
import { emit, useParentActors } from "./shared";

// ClickModifier: turns the parent Actor(s) into a clickable region.
// On pointer-down anywhere over the actor's collider, the configured
// event is emitted on the global event bus. Pair with a
// SceneSwitchModifier listening for the same event to build buttons
// (e.g. the Game Over "Restart" entity).
//
// Excalibur surfaces pointer events on each Actor via `actor.events`
// (PointerEvents config is enabled by default for Actors).

export default function ClickModifier({ id, data, parentId }: NodeProps) {
  const actors = useParentActors(parentId);
  const actorsKey = actors.map((a) => a.id).join(",");
  const [eventName, setEventName] = useState<string>(
    (data.eventName as string | undefined) ?? "",
  );
  const [hoverCursor, setHoverCursor] = useState<boolean>(
    (data.hoverCursor as boolean | undefined) ?? true,
  );

  useEffect(() => {
    if (actors.length === 0) return;
    const evt = eventName.trim();
    if (!evt) return;
    const unsubs: Array<() => void> = [];
    for (const actor of actors) {
      const onDown = () => {
        emit(evt, { actor });
      };
      try {
        const sub = (actor as any).on?.("pointerdown", onDown) as
          | { close: () => void }
          | undefined;
        if (sub) {
          unsubs.push(() => {
            try {
              sub.close?.();
            } catch {}
          });
        } else {
          // Fallback: directly use events emitter.
          (actor as any).events?.on?.("pointerdown", onDown);
          unsubs.push(() => {
            try {
              (actor as any).events?.off?.("pointerdown", onDown);
            } catch {}
          });
        }
      } catch {}
      if (hoverCursor) {
        try {
          // Excalibur PointerComponent supports useGraphicsBounds; the
          // default is to use the collider, which is fine for Actors
          // with explicit colliders.
          const onEnter = () => {
            document.body.style.cursor = "pointer";
          };
          const onLeave = () => {
            document.body.style.cursor = "";
          };
          (actor as any).on?.("pointerenter", onEnter);
          (actor as any).on?.("pointerleave", onLeave);
          unsubs.push(() => {
            try {
              (actor as any).events?.off?.("pointerenter", onEnter);
              (actor as any).events?.off?.("pointerleave", onLeave);
              document.body.style.cursor = "";
            } catch {}
          });
        } catch {}
      }
    }
    return () => unsubs.forEach((fn) => fn());
  }, [actorsKey, eventName, hoverCursor]);

  return (
    <ModShell
      id={id}
      data={data}
      accent="var(--accent-input)"
      title="Click"
      summary={eventName ? `emit ${eventName}` : "(no event)"}
    >
      <Field label="emit event">
        <input
          type="text"
          className="nrpg-input"
          style={{ width: 140, textAlign: "left" }}
          value={eventName}
          placeholder="e.g. restart-clicked"
          onChange={(e) => setEventName(e.currentTarget.value)}
        />
      </Field>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
        }}
      >
        <input
          type="checkbox"
          checked={hoverCursor}
          onChange={(e) =>
            setHoverCursor((e.currentTarget as HTMLInputElement).checked)
          }
        />
        cursor on hover
      </label>
    </ModShell>
  );
}
