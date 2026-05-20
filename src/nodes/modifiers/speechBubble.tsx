import { NodeProps, useReactFlow } from "@xyflow/react";
import { Actor, vec } from "excalibur";
import { createPortal } from "preact/compat";
import { useEffect, useState } from "preact/hooks";
import { Field, ModShell, Toggle } from "../../ui";
import { useGame } from "../../App";
import {
  useActiveDialogActor,
  useGameRect,
  usePlayMode,
  useParentActors,
  type GameRect,
} from "./shared";
import { StateChartComponent } from "./stateChart";

// SpeechBubbleModifier: floats the parent actor's current chart-state `say`
// text in a bubble above its head. One bubble per actor instance; it tracks
// the actor through camera-follow by projecting the world position to screen
// each frame, the same world→screen normalization the HUD/Toolbar use.

// Project an actor's world position to an on-screen (CSS pixel) point inside
// the live game canvas rect. Returns null if it can't be computed. Shared with
// the Dialog modifier's "press E" prompt.
export function projectActorToScreen(
  engine: any,
  actor: Actor,
  gameRect: GameRect,
): { x: number; y: number; scale: number } | null {
  try {
    if (!engine?.worldToScreenCoordinates) return null;
    // worldToScreenCoordinates returns Excalibur "screen space" — resolution
    // coordinates (0..resolution.width × 0..resolution.height), with the
    // camera/zoom already applied. Normalize by the RESOLUTION (not drawWidth,
    // which is resolution / cameraZoom) and scale onto the canvas's on-screen
    // rect.
    const res = engine.screen?.resolution;
    const gw = res?.width || engine.drawWidth || 1;
    const gh = res?.height || engine.drawHeight || 1;
    const proj = engine.worldToScreenCoordinates(actor.pos ?? vec(0, 0));
    return {
      x: gameRect.x + (proj.x / gw) * gameRect.w,
      y: gameRect.y + (proj.y / gh) * gameRect.h,
      scale: gameRect.scale ?? 1,
    };
  } catch {
    return null;
  }
}

export default function SpeechBubbleModifier({ id, data, parentId }: NodeProps) {
  const reactFlow = useReactFlow();
  const game = useGame();
  const gameRect = useGameRect();
  const playMode = usePlayMode();
  const actors = useParentActors(parentId);
  const activeDialogActor = useActiveDialogActor();

  const offsetY = (data.offsetY as number | undefined) ?? -14;
  const maxWidth = (data.maxWidth as number | undefined) ?? 120;
  const hideInEdit = (data.hideInEdit as boolean | undefined) ?? false;

  // Repaint ~30fps so the bubble tracks the actor as the camera follows.
  const [, force] = useState(0);
  useEffect(() => {
    const intv = setInterval(() => force((n) => n + 1), 1000 / 30);
    return () => clearInterval(intv);
  }, []);

  const show = !!gameRect && (playMode || !hideInEdit);
  const engine: any = game.engine;
  const currentScene = engine?.currentScene;

  type Bubble = { key: number; say: string; p: { x: number; y: number; scale: number } };
  const bubbles: Bubble[] = !show
    ? []
    : actors
        .map((a): Bubble | null => {
          if (a.isKilled?.()) return null;
          if (a.scene && currentScene && a.scene !== currentScene) return null;
          // While this NPC's Dialog panel is open, suppress the ambient bubble
          // so the conversation text only shows in the panel (not duplicated).
          if (activeDialogActor != null && a.id === activeDialogActor) return null;
          const comp = a.get(StateChartComponent);
          const say = comp?.say?.trim();
          if (!say) return null;
          const p = projectActorToScreen(engine, a, gameRect!);
          if (!p) return null;
          return { key: a.id, say, p };
        })
        .filter((b): b is Bubble => !!b);

  return (
    <>
      <ModShell
        id={id}
        data={data}
        accent="var(--accent-game)"
        title="Speech Bubble"
        summary={`above · offset ${offsetY}`}
      >
        <Field label="offset y">
          <input
            type="number"
            className="nrpg-input"
            value={offsetY}
            onChange={(e) => reactFlow.updateNodeData(id, { offsetY: +e.currentTarget.value })}
          />
        </Field>
        <Field label="max width">
          <input
            type="number"
            className="nrpg-input"
            value={maxWidth}
            onChange={(e) => reactFlow.updateNodeData(id, { maxWidth: +e.currentTarget.value })}
          />
        </Field>
        <Toggle
          label="hide in editor"
          checked={hideInEdit}
          onChange={(v) => reactFlow.updateNodeData(id, { hideInEdit: v })}
        />
      </ModShell>
      {/* Portal lives OUTSIDE ModShell so it renders even when the card is
          collapsed (ModShell unmounts its children when collapsed). It's
          clipped to the game-canvas rect (overflow:hidden) so a bubble near an
          edge stays inside the game view instead of painting over editor nodes.
          Bubbles are positioned relative to that clipping box. */}
      {bubbles.length > 0 &&
        gameRect &&
        createPortal(
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
            {bubbles.map((b) => {
              const sc = b.p.scale;
              return (
                <div
                  key={b.key}
                  style={{
                    position: "absolute",
                    left: b.p.x - gameRect.x,
                    top: b.p.y - gameRect.y + offsetY * sc,
                    transform: "translate(-50%, -100%)",
                    maxWidth: maxWidth * sc,
                    padding: `${3 * sc}px ${6 * sc}px`,
                    background: "rgba(11,13,18,0.92)",
                    border: "1px solid rgba(255,255,255,0.22)",
                    borderRadius: 6 * sc,
                    color: "#e8edf5",
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 11 * sc,
                    lineHeight: 1.25,
                    textAlign: "center",
                    whiteSpace: "pre-wrap",
                    textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                  }}
                >
                  {b.say}
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
