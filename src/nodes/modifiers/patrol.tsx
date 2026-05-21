import { NodeProps } from "@xyflow/react";
import { Actor, MotionComponent, TileMap, vec } from "excalibur";
import { useEffect, useState } from "preact/hooks";
import { Field, ModShell, Toggle } from "../../ui";
import { KnockbackComponent, RequestedHeadingComponent } from "./ecs";
import { useParentActors } from "./shared";
import { StateChartComponent } from "./stateChart";

// While the actor's State Chart (if any) is in one of these states, patrol
// freezes — e.g. the NPC holds still mid-conversation. No chart ⇒ never frozen.
const FREEZE_STATE = /talking|paused|dialog/i;

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
  // Optional aggro: when a `chaseTag` actor comes within `sightRange`, break
  // off patrol and home in on it (full 2D), resuming patrol once it leaves.
  const [chaseTag, setChaseTag] = useState<string>(
    (data.chaseTag as string | undefined) ?? "",
  );
  const [sightRange, setSightRange] = useState<number>(
    (data.sightRange as number | undefined) ?? 0,
  );
  // Vision is directional: the target must be within this cone (full angle,
  // degrees) of the way the patroller is currently facing. 360 = see all
  // around; 90 = a forward quarter-cone.
  const [sightAngle, setSightAngle] = useState<number>(
    (data.sightAngle as number | undefined) ?? 90,
  );
  // When chasing, stop this many px from the target so the patroller holds at
  // the player's edge instead of stacking on it. 0 = pursue to center.
  const [stopDistance, setStopDistance] = useState<number>(
    (data.stopDistance as number | undefined) ?? 0,
  );

  useEffect(() => {
    if (actors.length === 0) return;
    type PatrolState = {
      home: number;
      dir: 1 | -1;
      pausedUntil: number;
      rangeI: number;
      speedI: number;
      // Tracks whether this instance was chasing last tick, so we only fire
      // see-target / lost-target on the actual edge.
      chasingPrev: boolean;
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
        chasingPrev: false,
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
        // Don't fight an active knockback impulse — let KnockbackSystem drive
        // the velocity for the push window.
        const kb = a.get(KnockbackComponent);
        if (kb && kb.until > now) continue;
        // Freeze patrol while the actor's State Chart (if any) is talking/paused.
        const chart = a.get(StateChartComponent);
        if (chart && FREEZE_STATE.test(chart.current)) {
          if (motion) {
            motion.vel = horizontal
              ? vec(0, motion.vel.y)
              : vec(motion.vel.x, 0);
          }
          continue;
        }
        // Directional vision: chase a `chaseTag` target only if it's within
        // sightRange AND inside the cone the patroller is currently facing
        // (i.e. the way it's walking). Outside the cone it stays oblivious.
        if (chaseTag && sightRange > 0 && a.scene) {
          // Facing unit vector = current patrol direction along the axis.
          const fvx = horizontal ? state.dir : 0;
          const fvy = horizontal ? 0 : state.dir;
          const cosThresh = Math.cos(((sightAngle / 2) * Math.PI) / 180);
          let tgt: Actor | undefined;
          let bestD2 = sightRange * sightRange;
          for (const o of a.scene.actors) {
            if (o === a || !o.hasTag(chaseTag)) continue;
            const ox = o.pos.x - a.pos.x;
            const oy = o.pos.y - a.pos.y;
            const d2 = ox * ox + oy * oy;
            if (d2 > sightRange * sightRange) continue;
            const len = Math.hypot(ox, oy) || 1;
            // Cone test (skip when sightAngle >= 360 → see all around).
            if (sightAngle < 360) {
              const dot = (ox / len) * fvx + (oy / len) * fvy;
              if (dot < cosThresh) continue;
            }
            if (d2 <= bestD2) {
              bestD2 = d2;
              tgt = o as Actor;
            }
          }
          if (tgt) {
            const ox = tgt.pos.x - a.pos.x;
            const oy = tgt.pos.y - a.pos.y;
            const len = Math.hypot(ox, oy) || 1;
            // Face the target; stop moving once within the standoff distance.
            const holding = stopDistance > 0 && len <= stopDistance;
            if (motion) {
              motion.vel = holding
                ? vec(0, 0)
                : vec((ox / len) * state.speedI, (oy / len) * state.speedI);
            }
            if (req) req.heading = vec(ox / len, oy / len);
            // Edge-triggered: notify the chart it just spotted the target so an
            // author's chart can switch to a "chasing" state (drives bubbles/anim).
            if (!state.chasingPrev) {
              chart?.send("see-target");
              state.chasingPrev = true;
            }
            continue;
          }
          // Target left sight (or none) — fire the lost edge once.
          if (state.chasingPrev) {
            chart?.send("lost-target");
            state.chasingPrev = false;
          }
        }
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
  }, [actorsKey, speed, range, startDirection, pauseAtTurnMs, stayOnPlatform, axis, chaseTag, sightRange, sightAngle, stopDistance]);

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
        <Field label="chase tag">
          <input
            type="text"
            className="nrpg-input"
            style={{ width: 120, textAlign: "left" }}
            value={chaseTag}
            placeholder="(none) e.g. player"
            onChange={(e) => setChaseTag(e.currentTarget.value)}
          />
        </Field>
        <Field label="sight range">
          <input
            type="number"
            min={0}
            className="nrpg-input"
            value={sightRange}
            onChange={(e) => setSightRange(+e.currentTarget.value)}
          />
        </Field>
        <Field label="sight angle">
          <input
            type="number"
            min={0}
            max={360}
            className="nrpg-input"
            value={sightAngle}
            onChange={(e) => setSightAngle(+e.currentTarget.value)}
          />
        </Field>
        <Field label="stop distance">
          <input
            type="number"
            min={0}
            className="nrpg-input"
            value={stopDistance}
            title="When chasing, stop this many px from the target (0 = pursue to center)."
            onChange={(e) => setStopDistance(+e.currentTarget.value)}
          />
        </Field>
    </ModShell>
  );
}
