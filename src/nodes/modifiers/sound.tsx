import { NodeProps, useNodes } from "@xyflow/react";
import { useEffect, useState } from "preact/hooks";
import { Field } from "../../ui";
import {
  getSound,
  getSoundBaseVolume,
  on,
  useAssetVersion,
  useParentActor,
} from "./shared";

// Sound modifier: subscribes the parent actor's tag (or a free-form event
// name) to a Sound asset. When the event fires (e.g. "player-jumped"), the
// sound plays at the configured volume. Pairs naturally with the platformer
// Jump/Ground emitters and the new collision rule actions that emit events.

export default function SoundModifier({ data, parentId }: NodeProps) {
  const actor = useParentActor(parentId);
  const allNodes = useNodes();
  const soundNodes = allNodes.filter((n) => n.type === "sound");
  const [soundNodeId, setSoundNodeId] = useState<string>(
    (data.soundNodeId as string | undefined) ?? "",
  );
  const [eventName, setEventName] = useState<string>(
    (data.eventName as string | undefined) ?? "player-jumped",
  );
  const [volume, setVolume] = useState<number>(
    (data.volume as number | undefined) ?? 1,
  );
  const assetVersion = useAssetVersion();

  useEffect(() => {
    if (!actor) return;
    const trimmedEvent = eventName.trim();
    if (!trimmedEvent || !soundNodeId) return;
    const unsub = on(trimmedEvent, () => {
      const snd = getSound(soundNodeId);
      if (!snd) return;
      // Use the side-registry base volume — reading snd.volume directly
      // compounds because Excalibur's snd.play(v) overwrites snd.volume.
      try {
        snd.play(getSoundBaseVolume(soundNodeId) * volume);
      } catch {}
    });
    return () => unsub();
    // assetVersion ensures the listener is re-installed if the Sound asset
    // is registered after this modifier mounted (rare but harmless).
  }, [actor, soundNodeId, eventName, volume, assetVersion]);

  return (
    <div
      className="nrpg-mod"
      style={{ ["--accent" as any]: "var(--accent-entity)" }}
    >
      <div className="nrpg-mod-accent" />
      <div className="nrpg-mod-header">
        <span
          className="nrpg-header-dot"
          style={{ background: "var(--accent-entity)" }}
        />
        Sound
      </div>
      <div className="nrpg-mod-body nodrag">
        <Field label="sound">
          <select
            className="nrpg-select"
            value={soundNodeId}
            onChange={(e) => setSoundNodeId(e.currentTarget.value)}
          >
            <option value="">(none)</option>
            {soundNodes.map((n) => (
              <option key={n.id} value={n.id}>
                {((n.data?.label as string | undefined) ?? n.id) +
                  ` — ${n.id}`}
              </option>
            ))}
          </select>
        </Field>
        <Field label="event">
          <input
            type="text"
            className="nrpg-input"
            style={{ width: 120, textAlign: "left" }}
            value={eventName}
            placeholder="player-jumped"
            onChange={(e) => setEventName(e.currentTarget.value)}
          />
        </Field>
        <Field label="volume">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => setVolume(+e.currentTarget.value)}
          />
        </Field>
      </div>
    </div>
  );
}
