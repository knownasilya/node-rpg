import { NodeProps } from "@xyflow/react";
import { MotionComponent, vec } from "excalibur";
import { useEffect, useState } from "preact/hooks";
import { Field } from "../../ui";
import { RequestedHeadingComponent } from "./ecs";
import { useParentActors } from "./shared";

// Simple horizontal patrol AI. Each actor remembers the x it was spawned
// at and oscillates between `home.x - range` and `home.x + range` at
// `speed` px/s. Drives RequestedHeadingComponent so the AnimationModifier
// can pick the right facing/state, and writes vel.x directly so the
// patrol works even on Actors that don't have a PlatformerController.

export default function PatrolModifier({ data, parentId }: NodeProps) {
  const actors = useParentActors(parentId);
  const actorsKey = actors.map((a) => a.id).join(",");
  const [speed, setSpeed] = useState<number>(
    (data.speed as number | undefined) ?? 40,
  );
  const [range, setRange] = useState<number>(
    (data.range as number | undefined) ?? 48,
  );
  const [startDirection, setStartDirection] = useState<"left" | "right">(
    (data.startDirection as "left" | "right" | undefined) ?? "right",
  );
  const [pauseAtTurnMs, setPauseAtTurnMs] = useState<number>(
    (data.pauseAtTurnMs as number | undefined) ?? 0,
  );

  useEffect(() => {
    if (actors.length === 0) return;
    type PatrolState = {
      homeX: number;
      dir: 1 | -1;
      pausedUntil: number;
    };
    const home = new Map<number, PatrolState>();
    const now0 = performance.now();
    actors.forEach((a, idx) => {
      // Ensure RequestedHeadingComponent so animation/movement systems
      // pick up the patrol direction.
      if (!a.get(RequestedHeadingComponent)) {
        a.addComponent(new RequestedHeadingComponent());
      }
      // Desync instances: alternate the starting direction by index and
      // stagger the first turn with a small random pause. Without this
      // every instance traveled the same range at the same speed and
      // flipped direction in lockstep — three slimes moved as one.
      const flipParity = idx % 2 === 0 ? 1 : -1;
      const baseDir: 1 | -1 = startDirection === "left" ? -1 : 1;
      const dir = (flipParity === 1 ? baseDir : -baseDir) as 1 | -1;
      home.set(a.id, {
        homeX: a.pos.x,
        dir,
        pausedUntil: now0 + Math.random() * 600,
      });
    });

    const intv = setInterval(() => {
      const now = performance.now();
      for (const a of actors) {
        const state = home.get(a.id);
        if (!state) continue;
        const motion = a.get(MotionComponent);
        const req = a.get(RequestedHeadingComponent);
        const dx = a.pos.x - state.homeX;
        // Flip when we step past the range. The pause window holds the
        // direction at 0 (and clears vel.x) for a beat at each end.
        if (dx >= range && state.dir === 1) {
          state.dir = -1;
          state.pausedUntil = now + pauseAtTurnMs;
        } else if (dx <= -range && state.dir === -1) {
          state.dir = 1;
          state.pausedUntil = now + pauseAtTurnMs;
        }
        const paused = now < state.pausedUntil;
        const desired = paused ? 0 : state.dir * speed;
        if (motion) motion.vel = vec(desired, motion.vel.y);
        if (req)
          req.heading = vec(paused ? 0 : state.dir, req.heading.y);
      }
    }, 1000 / 60);
    return () => clearInterval(intv);
  }, [actorsKey, speed, range, startDirection, pauseAtTurnMs]);

  return (
    <div
      className="nrpg-mod"
      style={{ ["--accent" as any]: "var(--accent-movement)" }}
    >
      <div className="nrpg-mod-accent" />
      <div className="nrpg-mod-header">
        <span
          className="nrpg-header-dot"
          style={{ background: "var(--accent-movement)" }}
        />
        Patrol
      </div>
      <div className="nrpg-mod-body nodrag">
        <Field label="speed">
          <input
            type="number"
            min={0}
            className="nrpg-input"
            value={speed}
            onChange={(e) => setSpeed(+e.currentTarget.value)}
          />
        </Field>
        <Field label="range (±px)">
          <input
            type="number"
            min={0}
            className="nrpg-input"
            value={range}
            onChange={(e) => setRange(+e.currentTarget.value)}
          />
        </Field>
        <Field label="start dir">
          <select
            className="nrpg-select"
            value={startDirection}
            onChange={(e) =>
              setStartDirection(e.currentTarget.value as "left" | "right")
            }
          >
            <option value="right">right</option>
            <option value="left">left</option>
          </select>
        </Field>
        <Field label="pause (ms)">
          <input
            type="number"
            min={0}
            className="nrpg-input"
            value={pauseAtTurnMs}
            onChange={(e) => setPauseAtTurnMs(+e.currentTarget.value)}
          />
        </Field>
      </div>
    </div>
  );
}
