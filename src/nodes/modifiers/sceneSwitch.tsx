import { NodeProps, useNodes } from "@xyflow/react";
import { useEffect, useState } from "preact/hooks";
import { useGame } from "../../App";
import { Field, ModShell, Toggle } from "../../ui";
import { on } from "./shared";

// SceneSwitchModifier — global listener that swaps the engine's active
// scene when a configured trigger fires. Two trigger sources:
//
//   * an event bus emission (e.g. "player-died" from the HealthComponent
//     when onZero="emit"), or
//   * a keyboard press (e.g. KeyR to restart from the Game Over scene).
//
// Either or both can be set. The modifier is attached to a parent node
// only for UI placement — it doesn't read or mutate its parent actor.
// `alsoReset` calls game.reset() before the scene switch so transitions
// like "die → game over → restart → level-1" rebuild every entity at
// its spawn position with full health.

export default function SceneSwitchModifier({ id, data, parentId: _parentId }: NodeProps) {
  const game = useGame();
  const nodes = useNodes();
  const [eventName, setEventName] = useState<string>(
    (data.eventName as string | undefined) ?? "",
  );
  const [keyCode, setKeyCode] = useState<string>(
    (data.keyCode as string | undefined) ?? "",
  );
  const [targetSceneId, setTargetSceneId] = useState<string>(
    (data.targetSceneId as string | undefined) ?? "",
  );
  const [onlyInScene, setOnlyInScene] = useState<string>(
    (data.onlyInScene as string | undefined) ?? "",
  );
  const [alsoReset, setAlsoReset] = useState<boolean>(
    (data.alsoReset as boolean | undefined) ?? false,
  );

  // Resolve scene labels for the dropdown — show the user-facing label,
  // store the node id (which is also the scene id Excalibur knows it by).
  const sceneNodes = nodes.filter((n) => n.type === "scene");

  useEffect(() => {
    if (!targetSceneId) return;
    const trigger = () => {
      const engine = game.engine;
      if (!engine) return;
      if (onlyInScene) {
        // Only fire when the engine is currently on the gating scene.
        // Used for things like "KeyR restarts on Game Over but not
        // during normal play."
        const cur =
          (engine as any).currentSceneName ??
          (engine as any).currentScene?.name;
        if (cur !== onlyInScene) return;
      }
      if (!(engine as any).scenes?.[targetSceneId]) {
        console.warn(
          `[sceneSwitch] no scene "${targetSceneId}" registered yet`,
        );
        return;
      }
      if (alsoReset) game.reset();
      try {
        engine.goToScene(targetSceneId);
      } catch (err) {
        console.warn("[sceneSwitch] goToScene failed", err);
      }
    };

    const unsubs: Array<() => void> = [];
    const evt = eventName.trim();
    if (evt) {
      unsubs.push(on(evt, trigger));
    }
    const key = keyCode.trim();
    if (key) {
      const onKey = (e: KeyboardEvent) => {
        if (e.code === key) trigger();
      };
      window.addEventListener("keydown", onKey);
      unsubs.push(() => window.removeEventListener("keydown", onKey));
    }
    return () => unsubs.forEach((fn) => fn());
  }, [eventName, keyCode, targetSceneId, onlyInScene, alsoReset, game.engine]);

  const trigger = eventName ? `event ${eventName}` : keyCode ? `key ${keyCode}` : "?";
  const targetLabel =
    sceneNodes.find((n) => n.id === targetSceneId)?.data?.label ??
    targetSceneId ??
    "?";
  return (
    <ModShell
      id={id}
      data={data}
      accent="var(--accent-scene)"
      title="Scene Switch"
      summary={`when ${trigger} → ${targetLabel}`}
    >
        <Field label="on event">
          <input
            type="text"
            className="nrpg-input"
            style={{ width: 140, textAlign: "left" }}
            value={eventName}
            placeholder="e.g. player-died"
            onChange={(e) => setEventName(e.currentTarget.value)}
          />
        </Field>
        <Field label="on key">
          <input
            type="text"
            className="nrpg-input"
            style={{ width: 100, textAlign: "left" }}
            value={keyCode}
            placeholder="e.g. KeyR"
            onChange={(e) => setKeyCode(e.currentTarget.value)}
          />
        </Field>
        <Field label="target scene">
          <select
            className="nrpg-select"
            value={targetSceneId}
            onChange={(e) => setTargetSceneId(e.currentTarget.value)}
          >
            <option value="">(none)</option>
            {sceneNodes.map((n) => (
              <option key={n.id} value={n.id}>
                {((n.data as any)?.label as string | undefined) ?? n.id}
              </option>
            ))}
          </select>
        </Field>
        <Field label="only in scene">
          <select
            className="nrpg-select"
            value={onlyInScene}
            onChange={(e) => setOnlyInScene(e.currentTarget.value)}
            title="When set, only triggers if this scene is currently active."
          >
            <option value="">(any)</option>
            {sceneNodes.map((n) => (
              <option key={n.id} value={n.id}>
                {((n.data as any)?.label as string | undefined) ?? n.id}
              </option>
            ))}
          </select>
        </Field>
        <Toggle
          label="also reset"
          checked={alsoReset}
          onChange={setAlsoReset}
        />
    </ModShell>
  );
}
