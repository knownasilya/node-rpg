import { NodeProps, useNodes } from "@xyflow/react";
import { MotionComponent, vec } from "excalibur";
import { useEffect, useState } from "preact/hooks";
import { Field, ModShell } from "../../ui";
import { HealthComponent, RequestedHeadingComponent } from "./ecs";
import { emit, on, useParentActors } from "./shared";

// PathFollow (tower-defense creep): walk an actor along a list of pixel
// waypoints. Per-instance staggering turns a templated actor's `instances`
// into a wave — each instance waits `delay + index*stagger` ms (hidden) at the
// first waypoint, then marches. On reaching the last waypoint it damages the
// `baseTag` actor's HealthComponent, emits `endEvent`, and removes itself;
// when the base hits 0 HP it emits `gameOverEvent` once.

type Pt = { x: number; y: number };

export default function PathFollowModifier({ id, data, parentId }: NodeProps) {
  const actors = useParentActors(parentId);
  const actorsKey = actors.map((a) => a.id).join(",");
  const [speed, setSpeed] = useState<number>(
    (data.speed as number | undefined) ?? 45,
  );
  const [delayMs, setDelayMs] = useState<number>(
    (data.delayMs as number | undefined) ?? 0,
  );
  const [staggerMs, setStaggerMs] = useState<number>(
    (data.staggerMs as number | undefined) ?? 900,
  );
  const [baseTag, setBaseTag] = useState<string>(
    (data.baseTag as string | undefined) ?? "base",
  );
  const [baseDamage, setBaseDamage] = useState<number>(
    (data.baseDamage as number | undefined) ?? 1,
  );
  const [endEvent, setEndEvent] = useState<string>(
    (data.endEvent as string | undefined) ?? "base-hit",
  );
  const [gameOverEvent, setGameOverEvent] = useState<string>(
    (data.gameOverEvent as string | undefined) ?? "td-game-over",
  );
  const [startEvent, setStartEvent] = useState<string>(
    (data.startEvent as string | undefined) ?? "",
  );
  const [clearedEvent, setClearedEvent] = useState<string>(
    (data.clearedEvent as string | undefined) ?? "",
  );
  // Waypoints come from a referenced node's visual path editor (`pathFrom` =
  // a tiledMap node id with `pathWaypoints`), falling back to inline data.
  const [pathFrom, setPathFrom] = useState<string>(
    (data.pathFrom as string | undefined) ?? "",
  );
  const allNodes = useNodes();
  const sourceNode = pathFrom ? allNodes.find((n) => n.id === pathFrom) : undefined;
  const sourceWaypoints = (sourceNode?.data?.pathWaypoints as Pt[] | undefined) ?? undefined;
  const waypoints =
    sourceWaypoints && sourceWaypoints.length >= 2
      ? sourceWaypoints
      : (data.waypoints as Pt[] | undefined) ?? [];
  const waypointsKey = JSON.stringify(waypoints);

  useEffect(() => {
    if (actors.length === 0 || waypoints.length < 2) return;
    const start = waypoints[0];
    type S = { idx: number; i: number; released: boolean };
    const state = new Map<number, S>();
    actors.forEach((a, i) => {
      // Directional anim (if present) reads RequestedHeadingComponent; ensure
      // one exists so creeps face their travel direction.
      if (!a.get(RequestedHeadingComponent)) {
        a.addComponent(new RequestedHeadingComponent());
      }
      a.pos = vec(start.x, start.y);
      a.vel = vec(0, 0);
      try {
        (a as any).graphics.opacity = 0;
      } catch {}
      state.set(a.id, { idx: 1, i, released: false });
    });

    // The wave begins immediately, or waits for `startEvent` (so a Phase node
    // can launch it on the "attack" phase). It only actually starts once its
    // scene is the active one, so a global "attack" event doesn't run a wave
    // in an off-screen level — and each level's wave staggers fresh from when
    // its scene is entered. `waveStart` is when the first creep is released;
    // per-instance release = waveStart + delay + i*stagger.
    const sceneActive = (a: any) => {
      const eng = a.scene?.engine;
      return !!a.scene && (!eng?.currentScene || eng.currentScene === a.scene);
    };
    // Start the wave only when the trigger fires *while this wave's scene is
    // active* — so a global "attack" event from another level doesn't auto-run
    // this wave when its scene later becomes active (no stale latch). With no
    // startEvent, start as soon as the scene is active.
    let waveStart = 0;
    const immediate = !startEvent.trim();
    const tryStart = () => {
      if (waveStart === 0 && actors.some((a) => !a.isKilled?.() && sceneActive(a))) {
        waveStart = performance.now();
      }
    };
    const unsubStart = startEvent.trim() ? on(startEvent.trim(), tryStart) : () => {};

    let gameOverSent = false;
    let clearedSent = false;
    const resolved = new Set<number>();
    const intv = setInterval(() => {
      const now = performance.now();
      if (waveStart === 0) {
        if (immediate) tryStart();
        if (waveStart === 0) return;
      }
      for (const a of actors) {
        const s = state.get(a.id);
        if (!s) continue;
        // A creep killed by a tower counts as resolved for wave-clear.
        if (a.isKilled?.()) {
          resolved.add(a.id);
          continue;
        }
        // Don't march creeps that belong to an inactive scene.
        if (!sceneActive(a)) continue;
        const startAt = waveStart + delayMs + s.i * staggerMs;
        if (now < startAt) continue;
        if (!s.released) {
          s.released = true;
          try {
            (a as any).graphics.opacity = 1;
          } catch {}
        }
        const motion = a.get(MotionComponent);
        const req = a.get(RequestedHeadingComponent);
        const target = waypoints[s.idx];
        if (!target) continue;
        const dx = target.x - a.pos.x;
        const dy = target.y - a.pos.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= Math.max(2, (speed / 60) * 1.5)) {
          // Snap to the waypoint and advance.
          a.pos = vec(target.x, target.y);
          s.idx++;
          if (s.idx >= waypoints.length) {
            // Reached the base.
            const scene = a.scene;
            const base = scene?.actors.find((o) => o.hasTag(baseTag));
            const hp = base?.get(HealthComponent);
            if (hp) {
              hp.current = Math.max(0, hp.current - baseDamage);
              if (hp.current <= 0 && !gameOverSent && gameOverEvent.trim()) {
                gameOverSent = true;
                emit(gameOverEvent.trim(), { base }, id);
              }
            }
            if (endEvent.trim()) emit(endEvent.trim(), { actor: a }, id);
            try {
              a.kill();
            } catch {}
            resolved.add(a.id);
            continue;
          }
        } else {
          const ux = dx / dist;
          const uy = dy / dist;
          if (motion) motion.vel = vec(ux * speed, uy * speed);
          if (req) req.heading = vec(ux, uy);
        }
      }
      // Wave cleared: every creep has either been killed or reached the base.
      if (!clearedSent && clearedEvent.trim() && resolved.size >= actors.length) {
        clearedSent = true;
        emit(clearedEvent.trim(), {}, id);
      }
    }, 1000 / 60);
    return () => {
      clearInterval(intv);
      unsubStart();
    };
  }, [actorsKey, waypointsKey, speed, delayMs, staggerMs, baseTag, baseDamage, endEvent, gameOverEvent, startEvent, clearedEvent]);

  return (
    <ModShell
      id={id}
      data={data}
      accent="var(--accent-movement)"
      title="Path Follow"
      summary={`${waypoints.length} pts @ ${speed}`}
    >
      <Field label="speed">
        <input type="number" min={1} className="nrpg-input" value={speed}
          onChange={(e) => setSpeed(+e.currentTarget.value)} />
      </Field>
      <Field label="delay (ms)">
        <input type="number" min={0} className="nrpg-input" value={delayMs}
          onChange={(e) => setDelayMs(+e.currentTarget.value)} />
      </Field>
      <Field label="stagger (ms)">
        <input type="number" min={0} className="nrpg-input" value={staggerMs}
          onChange={(e) => setStaggerMs(+e.currentTarget.value)} />
      </Field>
      <Field label="base tag">
        <input type="text" className="nrpg-input" style={{ width: 120, textAlign: "left" }}
          value={baseTag} onChange={(e) => setBaseTag(e.currentTarget.value)} />
      </Field>
      <Field label="base dmg">
        <input type="number" min={0} className="nrpg-input" value={baseDamage}
          onChange={(e) => setBaseDamage(+e.currentTarget.value)} />
      </Field>
      <Field label="end event">
        <input type="text" className="nrpg-input" style={{ width: 120, textAlign: "left" }}
          value={endEvent} onChange={(e) => setEndEvent(e.currentTarget.value)} />
      </Field>
      <Field label="game over evt">
        <input type="text" className="nrpg-input" style={{ width: 120, textAlign: "left" }}
          value={gameOverEvent} onChange={(e) => setGameOverEvent(e.currentTarget.value)} />
      </Field>
      <Field label="start on">
        <input type="text" className="nrpg-input" style={{ width: 120, textAlign: "left" }}
          value={startEvent} placeholder="(immediate)" onChange={(e) => setStartEvent(e.currentTarget.value)} />
      </Field>
      <Field label="cleared evt">
        <input type="text" className="nrpg-input" style={{ width: 120, textAlign: "left" }}
          value={clearedEvent} placeholder="(none)" onChange={(e) => setClearedEvent(e.currentTarget.value)} />
      </Field>
      <Field label="path from">
        <select
          className="nrpg-select"
          value={pathFrom}
          onChange={(e) => setPathFrom(e.currentTarget.value)}
        >
          <option value="">(inline data)</option>
          {allNodes
            .filter((n) => n.type === "tiledMap")
            .map((n) => (
              <option key={n.id} value={n.id}>
                {((n.data?.label as string | undefined) ?? n.id) + ` — ${n.id}`}
              </option>
            ))}
        </select>
      </Field>
      <div style={{ fontSize: 10, color: "var(--text-subtle)" }}>
        {waypoints.length} waypoints{sourceNode ? " (from map — edit there)" : " (inline)"}
      </div>
    </ModShell>
  );
}
