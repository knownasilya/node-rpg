import { NodeProps } from "@xyflow/react";
import { vec } from "excalibur";
import { useEffect, useState } from "preact/hooks";
import { Field, ModShell } from "../../ui";
import { emit, useParentActors } from "./shared";

// Ball modifier (Pong): drives a constant-speed ball that reflects off
// paddles (with a little "english" based on where it hits) and the top/bottom
// scene walls, and resets to center + emits a score event when it reaches the
// left/right scene walls. Relies on the Scene's built-in edge walls, which are
// tagged "wall" + "top"/"bottom"/"left"/"right".

export default function BallModifier({ id, data, parentId }: NodeProps) {
  const actors = useParentActors(parentId);
  const actorsKey = actors.map((a) => a.id).join(",");
  const [speed, setSpeed] = useState<number>(
    (data.speed as number | undefined) ?? 220,
  );
  const [paddleTag, setPaddleTag] = useState<string>(
    (data.paddleTag as string | undefined) ?? "paddle",
  );
  const [wallTag, setWallTag] = useState<string>(
    (data.wallTag as string | undefined) ?? "hwall",
  );
  const [centerX, setCenterX] = useState<number>(
    (data.centerX as number | undefined) ?? 300,
  );
  const [centerY, setCenterY] = useState<number>(
    (data.centerY as number | undefined) ?? 200,
  );
  const [leftEvent, setLeftEvent] = useState<string>(
    (data.leftEvent as string | undefined) ?? "p2-scored",
  );
  const [rightEvent, setRightEvent] = useState<string>(
    (data.rightEvent as string | undefined) ?? "p1-scored",
  );

  useEffect(() => {
    if (actors.length === 0) return;
    const cleanups: (() => void)[] = [];
    for (const ball of actors) {
      const serve = (dir: number) => {
        // Random vertical spread so serves aren't identical.
        const spread = (Math.random() * 0.7 - 0.35) * (Math.PI / 2);
        const vx = Math.cos(spread) * dir;
        const vy = Math.sin(spread);
        const len = Math.hypot(vx, vy) || 1;
        ball.vel = vec((vx / len) * speed, (vy / len) * speed);
      };
      const reset = (dir: number) => {
        ball.pos = vec(centerX, centerY);
        // Brief pause then serve.
        ball.vel = vec(0, 0);
        setTimeout(() => serve(dir), 600);
      };
      serve(Math.random() < 0.5 ? -1 : 1);

      const onCol = (e: any) => {
        const other = e.other?.owner;
        if (!other || typeof other.hasTag !== "function") return;
        const b = other.collider?.bounds;
        // Reflections recompute the velocity from the configured `speed` and
        // geometry rather than the live ball.vel — the Arcade solver zeroes
        // the penetrating component on contact with a Fixed wall, so reading
        // ball.vel here would yield ~0 and the ball would stick. We also snap
        // the ball just outside the obstacle so it can't re-collide and wedge.
        if (other.hasTag(paddleTag)) {
          const dirX = ball.pos.x < other.pos.x ? -1 : 1; // bounce away
          const half = b ? (b.bottom - b.top) / 2 : 42;
          const rel = Math.max(-1, Math.min(1, (ball.pos.y - other.pos.y) / half));
          const vx = dirX;
          const vy = rel * 1.1; // steer by where it hit the paddle
          const len = Math.hypot(vx, vy) || 1;
          ball.vel = vec((vx / len) * speed, (vy / len) * speed);
          if (b) ball.pos = vec(dirX < 0 ? b.left - 7 : b.right + 7, ball.pos.y);
        } else if (other.hasTag(wallTag)) {
          const vyDir = ball.pos.y < other.pos.y ? -1 : 1; // away from wall
          const vx = ball.vel.x || speed * 0.6;
          const vyMag = Math.sqrt(Math.max(speed * speed - vx * vx, (speed * 0.4) ** 2));
          ball.vel = vec(vx, vyDir * vyMag);
          if (b) ball.pos = vec(ball.pos.x, vyDir < 0 ? b.top - 7 : b.bottom + 7);
        } else if (other.hasTag("left")) {
          if (rightEvent.trim()) emit(rightEvent.trim(), { ball }, id);
          reset(1);
        } else if (other.hasTag("right")) {
          if (leftEvent.trim()) emit(leftEvent.trim(), { ball }, id);
          reset(-1);
        }
      };
      ball.on("collisionstart", onCol);
      cleanups.push(() => ball.off("collisionstart", onCol));
    }
    return () => cleanups.forEach((f) => f());
  }, [actorsKey, speed, paddleTag, wallTag, centerX, centerY, leftEvent, rightEvent]);

  return (
    <ModShell
      id={id}
      data={data}
      accent="var(--accent-movement)"
      title="Ball"
      summary={`pong @ ${speed}`}
    >
      <Field label="speed">
        <input
          type="number"
          min={20}
          className="nrpg-input"
          value={speed}
          onChange={(e) => setSpeed(+e.currentTarget.value)}
        />
      </Field>
      <Field label="paddle tag">
        <input
          type="text"
          className="nrpg-input"
          style={{ width: 120, textAlign: "left" }}
          value={paddleTag}
          onChange={(e) => setPaddleTag(e.currentTarget.value)}
        />
      </Field>
      <Field label="wall tag">
        <input
          type="text"
          className="nrpg-input"
          style={{ width: 120, textAlign: "left" }}
          value={wallTag}
          onChange={(e) => setWallTag(e.currentTarget.value)}
        />
      </Field>
      <Field label="center x">
        <input
          type="number"
          className="nrpg-input"
          value={centerX}
          onChange={(e) => setCenterX(+e.currentTarget.value)}
        />
      </Field>
      <Field label="center y">
        <input
          type="number"
          className="nrpg-input"
          value={centerY}
          onChange={(e) => setCenterY(+e.currentTarget.value)}
        />
      </Field>
      <Field label="left goal evt">
        <input
          type="text"
          className="nrpg-input"
          style={{ width: 120, textAlign: "left" }}
          value={rightEvent}
          placeholder="p1-scored"
          onChange={(e) => setRightEvent(e.currentTarget.value)}
        />
      </Field>
      <Field label="right goal evt">
        <input
          type="text"
          className="nrpg-input"
          style={{ width: 120, textAlign: "left" }}
          value={leftEvent}
          placeholder="p2-scored"
          onChange={(e) => setLeftEvent(e.currentTarget.value)}
        />
      </Field>
    </ModShell>
  );
}
