import { NodeProps } from "@xyflow/react";
import { Actor, MotionComponent, TileMap, vec } from "excalibur";
import { useEffect, useState } from "preact/hooks";
import { Field, ModShell, Toggle } from "../../ui";
import { RequestedHeadingComponent } from "./ecs";
import { useParentActors } from "./shared";

// Simple horizontal patrol AI. Each actor remembers the x it was spawned
// at and oscillates between `home.x - range` and `home.x + range` at
// `speed` px/s. Drives RequestedHeadingComponent so the AnimationModifier
// can pick the right facing/state, and writes vel.x directly so the
// patrol works even on Actors that don't have a PlatformerController.

export default function PatrolModifier({ id, data, parentId }: NodeProps) {
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
  const [stayOnPlatform, setStayOnPlatform] = useState<boolean>(
    (data.stayOnPlatform as boolean | undefined) ?? true,
  );
  // Which axis to oscillate along. "horizontal" suits platformers (and keeps
  // the ledge-guard); "vertical" is for top-down up/down patrols.
  const [axis, setAxis] = useState<"horizontal" | "vertical">(
    (data.axis as "horizontal" | "vertical" | undefined) ?? "horizontal",
  );
  const horizontal = axis === "horizontal";

  useEffect(() => {
    if (actors.length === 0) return;
    type PatrolState = {
      home: number;
      dir: 1 | -1;
      pausedUntil: number;
      rangeI: number;
      speedI: number;
    };
    const home = new Map<number, PatrolState>();
    const now0 = performance.now();
    actors.forEach((a, idx) => {
      // Ensure RequestedHeadingComponent so animation/movement systems
      // pick up the patrol direction.
      if (!a.get(RequestedHeadingComponent)) {
        a.addComponent(new RequestedHeadingComponent());
      }
      // Randomize each instance so a group of patrollers don't move in
      // lockstep: alternate the base start direction by index, then jitter
      // the range (±30%), speed (±25%), and the first-turn phase per actor.
      const flipParity = idx % 2 === 0 ? 1 : -1;
      const baseDir: 1 | -1 = startDirection === "left" ? -1 : 1;
      const dir = (flipParity === 1 ? baseDir : -baseDir) as 1 | -1;
      home.set(a.id, {
        home: horizontal ? a.pos.x : a.pos.y,
        dir,
        pausedUntil: now0 + Math.random() * 800,
        rangeI: Math.max(8, range * (0.7 + Math.random() * 0.6)),
        speedI: Math.max(4, speed * (0.75 + Math.random() * 0.5)),
      });
    });

    // Look just past the actor's leading foot for solid ground below.
    // Returns true if the actor would step onto thin air. Probes both
    // Tiled TileMaps (via getTileByPoint) and tagged-solid actors. Mirrors
    // the same data sources GroundedSystem uses.
    const wouldFallOff = (a: Actor, dir: 1 | -1): boolean => {
      const scene = a.scene;
      if (!scene) return false;
      const bb = a.collider?.bounds;
      if (!bb) return false;
      const halfW = (bb.right - bb.left) / 2;
      // Sample a column 2px past the leading edge of the actor.
      const probeX = a.pos.x + dir * (halfW + 2);
      const probeY = bb.bottom + 2;
      for (const other of scene.actors) {
        if (other === a) continue;
        if (!other.hasTag("solid") && !other.hasTag("one-way-platform"))
          continue;
        const ob = other.collider?.bounds;
        if (!ob) continue;
        if (
          probeX >= ob.left &&
          probeX <= ob.right &&
          probeY >= ob.top &&
          probeY <= ob.bottom
        ) {
          return false;
        }
      }
      for (const ent of scene.entities) {
        if (!(ent instanceof TileMap)) continue;
        const tile = ent.getTileByPoint(vec(probeX, probeY));
        if (tile?.solid) return false;
      }
      return true;
    };

    const intv = setInterval(() => {
      const now = performance.now();
      for (const a of actors) {
        const state = home.get(a.id);
        if (!state) continue;
        const motion = a.get(MotionComponent);
        const req = a.get(RequestedHeadingComponent);
        // Distance from home along the active axis.
        const d = (horizontal ? a.pos.x : a.pos.y) - state.home;
        // Flip when we step past the per-instance range. The pause window
        // holds the direction at 0 for a beat at each end.
        if (d >= state.rangeI && state.dir === 1) {
          state.dir = -1;
          state.pausedUntil = now + pauseAtTurnMs;
        } else if (d <= -state.rangeI && state.dir === -1) {
          state.dir = 1;
          state.pausedUntil = now + pauseAtTurnMs;
        }
        // Ledge guard (horizontal/platformer only): before committing to a
        // step, peek under the leading foot. If there's no ground there, turn
        // around. Vertical/top-down patrols have no "ledge", so skip it.
        if (horizontal && stayOnPlatform && now >= state.pausedUntil) {
          if (wouldFallOff(a as Actor, state.dir)) {
            state.dir = (state.dir * -1) as 1 | -1;
            state.pausedUntil = now + pauseAtTurnMs;
          }
        }
        const paused = now < state.pausedUntil;
        const v = paused ? 0 : state.dir * state.speedI;
        const hdg = paused ? 0 : state.dir;
        if (motion) {
          motion.vel = horizontal
            ? vec(v, motion.vel.y)
            : vec(motion.vel.x, v);
        }
        if (req) {
          req.heading = horizontal
            ? vec(hdg, req.heading.y)
            : vec(req.heading.x, hdg);
        }
      }
    }, 1000 / 60);
    return () => clearInterval(intv);
  }, [actorsKey, speed, range, startDirection, pauseAtTurnMs, stayOnPlatform, axis]);

  return (
    <ModShell
      id={id}
      data={data}
      accent="var(--accent-movement)"
      title="Patrol"
      summary={`${axis === "vertical" ? "↕" : "↔"} ${speed}px/s ±${range}`}
    >
        <Field label="axis">
          <select
            className="nrpg-select"
            value={axis}
            onChange={(e) =>
              setAxis(e.currentTarget.value as "horizontal" | "vertical")
            }
          >
            <option value="horizontal">horizontal</option>
            <option value="vertical">vertical</option>
          </select>
        </Field>
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
        <Toggle
          label="stay on platform"
          checked={stayOnPlatform}
          onChange={setStayOnPlatform}
        />
    </ModShell>
  );
}
