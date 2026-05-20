import { NodeProps, useReactFlow } from "@xyflow/react";
import { Actor } from "excalibur";
import { createPortal } from "preact/compat";
import { useEffect, useRef, useState } from "preact/hooks";
import { Field, ModShell } from "../../ui";
import { useGame } from "../../App";
import {
  setActiveDialogActor,
  useGameRect,
  usePlayMode,
  useParentActors,
} from "./shared";
import { StateChartComponent } from "./stateChart";
import { projectActorToScreen } from "./speechBubble";

// DialogModifier: walk-up-and-talk for an NPC driven by its State Chart.
// When a `targetTag` actor (the player) comes within `range`, a "press <key>"
// prompt floats above the NPC. Pressing the key opens a docked panel showing
// the chart's current `say` text plus a button per labeled outgoing
// transition — clicking sends that event to THIS npc's chart, so the
// conversation branches. A state with no labeled options shows a Close button.

export default function DialogModifier({ id, data, parentId }: NodeProps) {
  const reactFlow = useReactFlow();
  const game = useGame();
  const gameRect = useGameRect();
  const playMode = usePlayMode();
  const actors = useParentActors(parentId);
  const actorsKey = actors.map((a) => a.id).join(",");

  const targetTag = (data.targetTag as string | undefined) ?? "player";
  const range = (data.range as number | undefined) ?? 28;
  const keyName = (data.key as string | undefined) ?? "KeyE";
  const promptText = (data.promptText as string | undefined) ?? "press E";
  // Optional events fired on this NPC's chart when the conversation opens /
  // closes. `startEvent` advances the chart off its ambient/idle state so the
  // first real line shows immediately on pressing the key; `endEvent` returns
  // it to idle when the panel closes (so the ambient bubble resumes).
  const startEvent = (data.startEvent as string | undefined) ?? "";
  const endEvent = (data.endEvent as string | undefined) ?? "";

  // The NPC instance the player is currently near (prompt target), and the one
  // an open conversation is bound to. Refs mirror state for the key handler.
  const [nearNpc, setNearNpc] = useState<Actor | null>(null);
  const [openNpc, setOpenNpc] = useState<Actor | null>(null);
  const nearRef = useRef<Actor | null>(null);
  const openRef = useRef<Actor | null>(null);
  nearRef.current = nearNpc;
  openRef.current = openNpc;
  // Bump to re-render the panel after a chart `send` updates the component.
  const [, force] = useState(0);

  const engine: any = game.engine;

  // Proximity scan + panel auto-close, ~30fps.
  useEffect(() => {
    const dist2 = (a: Actor, b: Actor) => {
      const dx = a.pos.x - b.pos.x;
      const dy = a.pos.y - b.pos.y;
      return dx * dx + dy * dy;
    };
    const intv = setInterval(() => {
      const scene = engine?.currentScene;
      let best: Actor | null = null;
      let bestD2 = range * range;
      for (const npc of actors) {
        if (npc.isKilled?.() || (npc.scene && scene && npc.scene !== scene)) continue;
        for (const o of npc.scene?.actors ?? []) {
          if (o === npc || !o.hasTag(targetTag)) continue;
          const d2 = dist2(npc, o);
          if (d2 <= bestD2) {
            bestD2 = d2;
            best = npc;
          }
        }
      }
      setNearNpc((prev) => (prev === best ? prev : best));

      // Auto-close the open conversation if the player walks away (hysteresis).
      const open = openRef.current;
      if (open) {
        const far = range * 1.5;
        let stillNear = false;
        for (const o of open.scene?.actors ?? []) {
          if (o === open || !o.hasTag(targetTag)) continue;
          if (dist2(open, o) <= far * far) {
            stillNear = true;
            break;
          }
        }
        if (!stillNear || open.isKilled?.()) {
          if (endEvent.trim() && !open.isKilled?.()) {
            open.get(StateChartComponent)?.send(endEvent.trim());
          }
          setOpenNpc(null);
        }
      }
      // Keep the panel text fresh as the chart advances.
      force((n) => n + 1);
    }, 1000 / 30);
    return () => clearInterval(intv);
  }, [actorsKey, targetTag, range, endEvent, engine]);

  // Open the conversation on key press while near an NPC.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code !== keyName && e.key !== keyName) return;
      const near = nearRef.current;
      if (near && !openRef.current) {
        // Advance off the ambient/idle state so the first real line shows.
        if (startEvent.trim()) near.get(StateChartComponent)?.send(startEvent.trim());
        setOpenNpc(near);
        force((n) => n + 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [keyName, startEvent]);

  // Publish which NPC's panel is open so the Speech Bubble hides its ambient
  // bubble for that actor (no duplicated text). Clear on unmount.
  useEffect(() => {
    setActiveDialogActor(openNpc?.id ?? null);
    return () => setActiveDialogActor(null);
  }, [openNpc]);

  // Close + reset on game reset (actors are recreated, refs go stale).
  useEffect(() => {
    setOpenNpc(null);
    setNearNpc(null);
    setActiveDialogActor(null);
  }, [game.resetTick]);

  // Render whenever the game canvas is on screen — works in the in-editor
  // preview as well as fullscreen play (matches the Speech Bubble / Toolbar).
  // playMode only affects z-index layering below.
  const showOverlay = !!gameRect;
  const scale = gameRect?.scale ?? 1;

  // Prompt bubble above the near NPC (only when not already talking).
  const promptP =
    showOverlay && nearNpc && !openNpc && !nearNpc.isKilled?.()
      ? projectActorToScreen(engine, nearNpc, gameRect!)
      : null;

  // Panel content from the open NPC's chart component.
  const comp = openNpc ? openNpc.get(StateChartComponent) : undefined;
  const say = comp?.say ?? "";
  const options = comp?.options ?? [];

  const panelStyle = (): Record<string, any> => {
    const r = gameRect!;
    const sc = (n: number) => n * scale;
    return {
      position: "fixed",
      left: r.x + sc(12),
      width: r.w - sc(24),
      bottom: window.innerHeight - (r.y + r.h) + sc(12),
      zIndex: playMode ? 101 : 6,
      display: "flex",
      flexDirection: "column",
      gap: sc(8),
      padding: `${sc(10)}px ${sc(12)}px`,
      background: "rgba(11,13,18,0.95)",
      border: "1px solid rgba(255,255,255,0.22)",
      borderRadius: sc(8),
      color: "#e8edf5",
      fontFamily: "ui-monospace, monospace",
      boxSizing: "border-box",
      pointerEvents: "auto",
    };
  };

  return (
    <>
      <ModShell
        id={id}
        data={data}
        accent="var(--accent-input)"
        title="Dialog"
        summary={`talk · ${keyName} · ≤${range}px`}
      >
        <Field label="target tag">
          <input
            type="text"
            className="nrpg-input"
            style={{ width: 120, textAlign: "left" }}
            value={targetTag}
            onChange={(e) => reactFlow.updateNodeData(id, { targetTag: e.currentTarget.value })}
          />
        </Field>
        <Field label="range (px)">
          <input
            type="number"
            className="nrpg-input"
            value={range}
            onChange={(e) => reactFlow.updateNodeData(id, { range: +e.currentTarget.value })}
          />
        </Field>
        <Field label="key">
          <input
            type="text"
            className="nrpg-input"
            style={{ width: 120, textAlign: "left" }}
            value={keyName}
            placeholder="e.g. KeyE"
            onChange={(e) => reactFlow.updateNodeData(id, { key: e.currentTarget.value })}
          />
        </Field>
        <Field label="prompt text">
          <input
            type="text"
            className="nrpg-input"
            style={{ width: 120, textAlign: "left" }}
            value={promptText}
            onChange={(e) => reactFlow.updateNodeData(id, { promptText: e.currentTarget.value })}
          />
        </Field>
        <Field label="start event">
          <input
            type="text"
            className="nrpg-input"
            style={{ width: 120, textAlign: "left" }}
            value={startEvent}
            placeholder="(optional) fired on open"
            onChange={(e) => reactFlow.updateNodeData(id, { startEvent: e.currentTarget.value })}
          />
        </Field>
        <Field label="end event">
          <input
            type="text"
            className="nrpg-input"
            style={{ width: 120, textAlign: "left" }}
            value={endEvent}
            placeholder="(optional) fired on close"
            onChange={(e) => reactFlow.updateNodeData(id, { endEvent: e.currentTarget.value })}
          />
        </Field>
      </ModShell>

      {/* Portals live OUTSIDE ModShell so they render even when the card is
          collapsed (ModShell unmounts its children when collapsed). */}
      {promptP &&
        gameRect &&
        createPortal(
          // Clipped to the game-canvas rect so the prompt stays inside the
          // game view instead of overflowing onto editor nodes.
          <div
            style={{
              position: "fixed",
              left: gameRect.x,
              top: gameRect.y,
              width: gameRect.w,
              height: gameRect.h,
              overflow: "hidden",
              pointerEvents: "none",
              zIndex: playMode ? 101 : 6,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: promptP.x - gameRect.x,
                top: promptP.y - gameRect.y - 22 * promptP.scale,
                transform: "translate(-50%, -100%)",
                padding: `${3 * promptP.scale}px ${7 * promptP.scale}px`,
                background: "rgba(20,120,200,0.92)",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: 6 * promptP.scale,
                color: "#fff",
                fontFamily: "ui-monospace, monospace",
                fontSize: 11 * promptP.scale,
                fontWeight: 700,
                whiteSpace: "nowrap",
                textShadow: "0 1px 2px rgba(0,0,0,0.6)",
              }}
            >
              {promptText}
            </div>
          </div>,
          document.body,
        )}

      {showOverlay &&
        openNpc &&
        createPortal(
          <div style={panelStyle()}>
            <div style={{ fontSize: 13 * scale, lineHeight: 1.35, whiteSpace: "pre-wrap" }}>
              {say || "…"}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 * scale }}>
              {options.length > 0 ? (
                options.map((opt, i) => (
                  <button
                    key={`${opt.event}-${i}`}
                    onClick={() => {
                      comp?.send(opt.event);
                      force((n) => n + 1);
                    }}
                    style={{
                      padding: `${5 * scale}px ${10 * scale}px`,
                      borderRadius: 5 * scale,
                      border: `${1 * scale}px solid #3a86ff`,
                      background: "#1f2733",
                      color: "#cfe3ff",
                      fontWeight: 700,
                      fontSize: 11 * scale,
                      cursor: "pointer",
                    }}
                  >
                    {opt.label}
                  </button>
                ))
              ) : (
                <button
                  onClick={() => {
                    if (endEvent.trim()) comp?.send(endEvent.trim());
                    setOpenNpc(null);
                  }}
                  style={{
                    padding: `${5 * scale}px ${10 * scale}px`,
                    borderRadius: 5 * scale,
                    border: `${1 * scale}px solid #555`,
                    background: "#2a2f3a",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 11 * scale,
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
