import { Handle, NodeProps, Position, useReactFlow } from "@xyflow/react";
import { Actor, CollisionType, vec } from "excalibur";
import { createPortal } from "preact/compat";
import { useEffect, useRef, useState } from "preact/hooks";
import { Field, NodeBody, NodeCard, NodeHeader } from "../ui";
import { useGame } from "../App";
import {
  addPoints,
  emit,
  getCurrentState,
  getPoints,
  getSpritesheet,
  on,
  setPoints,
  useCurrentState,
  useGameRect,
  usePlayMode,
  usePoints,
} from "./modifiers/shared";
import { fireTower } from "./modifiers/towerCore";

// General on-screen Toolbar: a configurable row of buttons shown over the game
// (in play mode), optionally only during a given state-machine state. Each
// item does one of:
//   * "emit"  — fire an event (e.g. a READY button → "ready").
//   * "place" — click the item, then click the field to spawn an actor (sprite
//     from a spritesheet frame + tags), spending `cost` points. The placed
//     actor can optionally run a built-in behavior ("tower" = shoot the nearest
//     tagged actor in range).
// Optional economy: `startingPoints` + earn `earnAmount` per `earnEvent`.
// Not tied to any one game — drive it from a State Machine + events.

type Item = {
  label: string;
  kind: "emit" | "place";
  event?: string;
  cost?: number;
  iconFrame?: number;
  // placement:
  spawnTags?: string[];
  spawnW?: number;
  spawnH?: number;
  behavior?: "none" | "tower";
  range?: number;
  damage?: number;
  cooldownMs?: number;
  targetTag?: string;
};

export default function ToolbarNode({ id, data }: NodeProps) {
  const reactFlow = useReactFlow();
  const game = useGame();
  const gameRect = useGameRect();
  const playMode = usePlayMode();
  const machineState = useCurrentState();
  const points = usePoints();

  const activeState = (data.activeState as string | undefined) ?? "";
  // Layout: which screen edge it docks to, and whether items run in a row or
  // a column. (Back-compat: old `position` field maps to `anchor`.)
  const anchor =
    (data.anchor as "top" | "bottom" | "left" | "right" | undefined) ??
    (data.position as "top" | "bottom" | undefined) ??
    "bottom";
  const orientation =
    (data.orientation as "horizontal" | "vertical" | undefined) ??
    (anchor === "left" || anchor === "right" ? "vertical" : "horizontal");
  // Scene ids the toolbar is hidden on (e.g. a "Game Over" screen). Stored as
  // an array; the editor field below edits it as a comma-separated list.
  const hideOnScenes = (data.hideOnScenes as string[] | undefined) ?? [];
  const hideOnScenesKey = hideOnScenes.join(",");
  const startingPoints = (data.startingPoints as number | undefined) ?? 0;
  const earnEvent = (data.earnEvent as string | undefined) ?? "";
  const earnAmount = (data.earnAmount as number | undefined) ?? 0;
  const iconSheetId = (data.iconSheetId as string | undefined) ?? "";
  const items = (data.items as Item[] | undefined) ?? [];
  const itemsKey = JSON.stringify(items);
  const economy = startingPoints > 0 || items.some((it) => (it.cost ?? 0) > 0);

  const [selected, setSelected] = useState<number>(-1);
  const selectedRef = useRef(-1);
  selectedRef.current = selected;

  // Track the active scene so the toolbar can hide itself on configured
  // scenes. There's no reactive current-scene store, so poll the engine and
  // only re-render when the name actually changes.
  const [currentScene, setCurrentScene] = useState<string>("");
  useEffect(() => {
    if (hideOnScenes.length === 0) return;
    const read = () => {
      const name = (game.engine as any)?.currentSceneName ?? "";
      setCurrentScene((prev) => (prev === name ? prev : name));
    };
    read();
    const intv = setInterval(read, 150);
    return () => clearInterval(intv);
  }, [game.engine, hideOnScenesKey]);

  // Economy reset + earn.
  useEffect(() => {
    if (!economy) return;
    setPoints(startingPoints);
    if (!earnEvent.trim() || !earnAmount) return;
    return on(earnEvent.trim(), () => addPoints(earnAmount));
  }, [economy, startingPoints, earnEvent, earnAmount, game.resetTick]);

  // Placed actors + their behavior tick.
  const placedRef = useRef<{ actor: Actor; cfg: any }[]>([]);
  useEffect(() => {
    const last = new Map<number, number>();
    const intv = setInterval(() => {
      const now = performance.now();
      for (const p of placedRef.current) {
        if (p.cfg && !p.actor.isKilled?.()) fireTower(p.actor, p.cfg, last, now);
      }
    }, 1000 / 30);
    return () => clearInterval(intv);
  }, []);
  useEffect(() => {
    for (const p of placedRef.current) {
      try {
        p.actor.kill();
      } catch {}
    }
    placedRef.current = [];
  }, [game.resetTick]);

  // Field-click placement.
  useEffect(() => {
    const engine: any = game.engine;
    const ptr = engine?.input?.pointers?.primary;
    if (!ptr) return;
    const handler = (evt: any) => {
      const idx = selectedRef.current;
      const it = items[idx];
      if (!it || it.kind !== "place") return;
      if (activeState && getCurrentState().name !== activeState) return;
      if ((it.cost ?? 0) > getPoints()) return;
      const scene = engine.currentScene;
      const world = evt.worldPos ?? evt.coordinates?.worldPos;
      if (!scene || !world) return;
      const a = new Actor({
        pos: vec(world.x, world.y),
        width: it.spawnW ?? 24,
        height: it.spawnH ?? 28,
        collisionType: CollisionType.PreventCollision,
      });
      for (const tag of it.spawnTags ?? []) a.addTag(tag);
      const sheet = iconSheetId ? getSpritesheet(iconSheetId) : undefined;
      const sprite = sheet?.sprites[it.iconFrame ?? 0];
      if (sprite) a.graphics.use(sprite.clone());
      a.z = 10;
      scene.add(a);
      const cfg =
        it.behavior === "tower"
          ? {
              range: it.range ?? 70,
              damage: it.damage ?? 1,
              cooldownMs: it.cooldownMs ?? 700,
              targetTag: it.targetTag ?? "enemy",
              killEvent: it.event?.trim() || "enemy-killed",
            }
          : null;
      placedRef.current.push({ actor: a, cfg });
      if ((it.cost ?? 0) > 0) addPoints(-(it.cost ?? 0));
    };
    ptr.on("down", handler);
    return () => {
      try {
        ptr.off("down", handler);
      } catch {}
    };
  }, [game.engine, itemsKey, activeState, iconSheetId]);

  const showToolbar =
    !!gameRect &&
    (!activeState || machineState.name === activeState) &&
    !hideOnScenes.includes(currentScene);
  // Dock the bar to an edge of the live game canvas (so it sits *inside* the
  // game view in both the editor preview and fullscreen play).
  // Scale the bar with the on-screen game view (editor zoom / fullscreen),
  // published on gameRect.scale, so it tracks the game instead of staying a
  // fixed screen size.
  const scale = gameRect?.scale ?? 1;
  const sc = (n: number) => n * scale;
  const railStyle = (): Record<string, any> => {
    const r = gameRect!;
    const s: Record<string, any> = {
      position: "fixed",
      // Sit just above the game canvas portal (editor z:5, play z:100) inside
      // an isolated stacking context — not blasted to the top where it would
      // paint over unrelated canvas nodes.
      isolation: "isolate",
      zIndex: playMode ? 101 : 6,
      display: "flex",
      flexDirection: orientation === "vertical" ? "column" : "row",
      gap: sc(6),
      alignItems: "center",
      justifyContent: "center",
      padding: `${sc(6)}px ${sc(8)}px`,
      background: "rgba(11,13,18,0.9)",
      border: "1px solid rgba(255,255,255,0.16)",
      fontFamily: "ui-monospace, monospace",
      pointerEvents: "auto",
      boxSizing: "border-box",
      flexWrap: "wrap",
    };
    if (anchor === "bottom") {
      s.left = r.x; s.width = r.w; s.bottom = window.innerHeight - (r.y + r.h);
    } else if (anchor === "top") {
      s.left = r.x; s.width = r.w; s.top = r.y;
    } else if (anchor === "left") {
      s.left = r.x; s.top = r.y; s.height = r.h;
    } else {
      s.right = window.innerWidth - (r.x + r.w); s.top = r.y; s.height = r.h;
    }
    return s;
  };

  // --- Editor helpers ----------------------------------------------------
  const updateItem = (i: number, patch: Partial<Item>) => {
    const next = items.map((it, idx) => (idx === i ? { ...it, ...patch } : it));
    reactFlow.updateNodeData(id, { items: next });
  };
  const addItem = () =>
    reactFlow.updateNodeData(id, {
      items: [...items, { label: "Item", kind: "emit", event: "" }],
    });
  const removeItem = (i: number) =>
    reactFlow.updateNodeData(id, { items: items.filter((_, idx) => idx !== i) });

  return (
    <>
      <NodeCard accent="game" style={{ minWidth: 260 }}>
        <NodeHeader
          title={(data.label as string) ?? "Toolbar"}
          subtitle="toolbar / hud"
          accent="game"
          onTitleChange={(v) => reactFlow.updateNodeData(id, { label: v })}
        />
        <Handle type="source" position={Position.Right} />
        <NodeBody>
          <Field label="active state">
            <input
              type="text"
              className="nrpg-input"
              style={{ width: 120, textAlign: "left" }}
              value={activeState}
              placeholder="(always)"
              onChange={(e) => reactFlow.updateNodeData(id, { activeState: e.currentTarget.value })}
            />
          </Field>
          <Field label="hide on scenes">
            <input
              type="text"
              className="nrpg-input"
              style={{ width: 120, textAlign: "left" }}
              value={hideOnScenesKey}
              placeholder="e.g. scene-game-over"
              title="Comma-separated scene ids to hide the toolbar on"
              onChange={(e) =>
                reactFlow.updateNodeData(id, {
                  hideOnScenes: e.currentTarget.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </Field>
          <Field label="anchor">
            <select
              className="nrpg-select"
              value={anchor}
              onChange={(e) => reactFlow.updateNodeData(id, { anchor: e.currentTarget.value })}
            >
              <option value="bottom">bottom</option>
              <option value="top">top</option>
              <option value="left">left</option>
              <option value="right">right</option>
            </select>
          </Field>
          <Field label="orientation">
            <select
              className="nrpg-select"
              value={orientation}
              onChange={(e) => reactFlow.updateNodeData(id, { orientation: e.currentTarget.value })}
            >
              <option value="horizontal">horizontal</option>
              <option value="vertical">vertical</option>
            </select>
          </Field>
          {economy && (
            <div style={{ fontSize: 11, color: "var(--text-subtle)" }}>points: {points}</div>
          )}
          <div style={{ fontSize: 10, color: "var(--text-subtle)", margin: "2px 0" }}>items</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {items.map((it, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 4,
                  alignItems: "center",
                  background: "var(--bg-subtle)",
                  borderRadius: 4,
                  padding: 4,
                }}
              >
                <input
                  className="nrpg-input"
                  style={{ width: 64 }}
                  value={it.label}
                  onChange={(e) => updateItem(i, { label: e.currentTarget.value })}
                />
                <select
                  className="nrpg-select"
                  style={{ width: 64 }}
                  value={it.kind}
                  onChange={(e) => updateItem(i, { kind: e.currentTarget.value as Item["kind"] })}
                >
                  <option value="emit">emit</option>
                  <option value="place">place</option>
                </select>
                <input
                  className="nrpg-input"
                  style={{ width: 80 }}
                  placeholder={it.kind === "emit" ? "event" : "event?"}
                  value={it.event ?? ""}
                  onChange={(e) => updateItem(i, { event: e.currentTarget.value })}
                />
                <input
                  type="number"
                  className="nrpg-input"
                  style={{ width: 44 }}
                  title="cost"
                  value={it.cost ?? 0}
                  onChange={(e) => updateItem(i, { cost: +e.currentTarget.value })}
                />
                <button className="nrpg-btn icon" onClick={() => removeItem(i)} title="remove">
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button className="nrpg-btn" style={{ marginTop: 4 }} onClick={addItem}>
            + item
          </button>
        </NodeBody>
      </NodeCard>
      {showToolbar &&
        createPortal(
          <div style={railStyle()}>
            {economy && (
              <div style={{ color: "#ffe066", fontWeight: 700, marginRight: sc(4), fontSize: sc(11) }}>💰 {points}</div>
            )}
            {items.map((it, i) => {
              const cost = it.cost ?? 0;
              const affordable = cost <= points;
              const isSel = selected === i;
              const isPlace = it.kind === "place";
              return (
                <button
                  key={i}
                  disabled={isPlace && !affordable}
                  onClick={() => {
                    if (it.kind === "emit") {
                      if (it.event?.trim()) emit(it.event.trim(), {}, id);
                    } else {
                      setSelected(isSel ? -1 : i);
                    }
                  }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: sc(2),
                    padding: `${sc(5)}px ${sc(9)}px`,
                    borderRadius: sc(5),
                    border: isSel ? `${sc(2)}px solid #9be7ff` : `${sc(2)}px solid transparent`,
                    background: it.kind === "emit" ? "#3fbf6b" : affordable ? "#1f2733" : "#15171c",
                    color: it.kind === "emit" ? "#08120b" : affordable ? "#fff" : "#5b6470",
                    cursor: isPlace && !affordable ? "not-allowed" : "pointer",
                    fontWeight: 700,
                    minWidth: sc(48),
                  }}
                >
                  <span style={{ fontSize: sc(10) }}>{it.label}</span>
                  {cost > 0 && <span style={{ fontSize: sc(9), color: "#ffe066" }}>💰 {cost}</span>}
                </button>
              );
            })}
            {selected >= 0 && items[selected]?.kind === "place" && (
              <div style={{ color: "#9be7ff", fontSize: sc(10), marginLeft: sc(6) }}>
                click field to place {items[selected]?.label}
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
