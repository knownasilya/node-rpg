import {
  Handle,
  NodeProps,
  Position,
  useEdges,
  useReactFlow,
} from "@xyflow/react";
import {
  Actor,
  CollisionType,
  Color,
  Entity,
  Scene,
} from "excalibur";
import { useEffect, useRef, useState } from "preact/hooks";
import { useGame } from "../App";
import { Field, NodeBody, NodeCard, NodeHeader } from "../ui";
import {
  FollowerComponent,
  TailGrowerComponent,
} from "./modifiers/ecs";
import { getLeaderHistoryPosOrOldest } from "./modifiers/shared";

const colors: Record<string, Color> = {
  red: Color.Red,
  green: Color.Green,
  blue: Color.Blue,
  yellow: Color.Yellow,
  white: Color.White,
  gray: Color.Gray,
  black: Color.Black,
};

const colorFor = (k: string): Color => colors[k] ?? Color.Green;

export default function TailNode({ id, data }: NodeProps) {
  const game = useGame();
  const edges = useEdges();
  const reactFlow = useReactFlow();
  const segmentsRef = useRef<Actor[]>([]);

  const [leaderTag, setLeaderTag] = useState<string>(
    (data.leaderTag as string | undefined) ?? "snake-head",
  );
  // `data.length` is the user-configurable starting length; `growBonus` is
  // session-scoped so it resets on game reset.
  const baseLength = (data.length as number | undefined) ?? 1;
  const [growBonus, setGrowBonus] = useState(0);
  const length = Math.max(0, baseLength + growBonus);
  const setLength = (v: number) =>
    reactFlow.updateNodeData(id, { length: Math.max(0, v) });

  useEffect(() => {
    setGrowBonus(0);
  }, [game.resetTick]);

  const [segmentTag, setSegmentTag] = useState<string>(
    (data.segmentTag as string | undefined) ?? "snake-tail",
  );
  const [color, setColor] = useState<string>(
    (data.color as string | undefined) ?? "green",
  );
  const [size, setSize] = useState<number>(
    (data.size as number | undefined) ?? 20,
  );

  const sceneEdge = edges.find(
    (e) => e.source === id && e.target.startsWith("scene-"),
  );
  const sceneId = sceneEdge?.target;
  const scene = sceneId
    ? (game.entities[sceneId] as Scene | undefined)
    : undefined;

  // Register a grow callback via a marker Entity + TailGrowerComponent. The
  // component handles register/unregister in its lifecycle, so we never call
  // the registry directly.
  useEffect(() => {
    if (!scene) return;
    const tag = leaderTag.trim();
    if (!tag) return;
    const marker = new Entity();
    marker.addComponent(
      new TailGrowerComponent(tag, (delta) =>
        setGrowBonus((b) => Math.max(0, b + delta)),
      ),
    );
    scene.world.add(marker);
    return () => {
      scene.world.remove(marker, false);
    };
  }, [scene, leaderTag]);

  // Setup / teardown when engine, scene, or segment style changes — and on
  // reset (so all segments are killed and recreated).
  useEffect(() => {
    if (!game.engine || !scene) return;
    return () => {
      segmentsRef.current.forEach((s) => {
        if (s.scene) s.kill();
      });
      segmentsRef.current = [];
    };
  }, [game.engine, scene, leaderTag, segmentTag, color, size, game.resetTick]);

  // Sync segment count to `length` (incremental — no flash on grow).
  useEffect(() => {
    if (!game.engine || !scene) return;
    const current = segmentsRef.current;

    while (current.length < length) {
      const delay = current.length + 1;

      const leader = scene.actors.find((a) => a.hasTag(leaderTag));
      if (!leader) break;
      const trailing = getLeaderHistoryPosOrOldest(leaderTag, delay);
      const initX = trailing?.x ?? leader.pos.x;
      const initY = trailing?.y ?? leader.pos.y;

      const seg = new Actor({
        name: `${segmentTag}-${delay}`,
        x: initX,
        y: initY,
        width: size,
        height: size,
        color: colorFor(color),
        collisionType: CollisionType.Passive,
      });
      // FollowerSystem will rewrite pos every frame; the body must stay awake.
      seg.body.canSleep = false;
      const follower = new FollowerComponent(leaderTag, delay);
      // Tag is applied only once the seg occupies a different cell than the
      // leader — otherwise a head↔segment collision rule would fire on the
      // same tick the tag is applied. FollowerSystem handles the delayed tag.
      follower.tagOnceOffLeader = segmentTag;
      seg.addComponent(follower);

      scene.add(seg);
      current.push(seg);
    }

    while (current.length > length) {
      const seg = current.pop();
      if (seg?.scene) seg.kill();
    }
  }, [
    game.engine,
    scene,
    length,
    leaderTag,
    segmentTag,
    color,
    size,
    game.resetTick,
  ]);

  return (
    <NodeCard accent="follower" style={{ minWidth: 240 }}>
      <NodeHeader
        title={(data.label as string) ?? "Tail"}
        accent="follower"
        onTitleChange={(v) => reactFlow.updateNodeData(id, { label: v })}
      />
      <Handle type="source" position={Position.Right} />
      <NodeBody>
        <Field label="leader tag">
          <input
            type="text"
            className="nrpg-input"
            style={{ width: 120, textAlign: "left" }}
            value={leaderTag}
            placeholder="e.g. snake-head"
            onChange={(e) => setLeaderTag(e.currentTarget.value)}
          />
        </Field>
        <Field label="segment tag">
          <input
            type="text"
            className="nrpg-input"
            style={{ width: 120, textAlign: "left" }}
            value={segmentTag}
            placeholder="e.g. snake-tail"
            onChange={(e) => setSegmentTag(e.currentTarget.value)}
          />
        </Field>
        <Field label="length">
          <input
            type="number"
            className="nrpg-input"
            value={baseLength}
            min={0}
            onChange={(e) => setLength(+e.currentTarget.value)}
          />
        </Field>
        <Field label="size">
          <input
            type="number"
            className="nrpg-input"
            value={size}
            onChange={(e) => setSize(+e.currentTarget.value)}
          />
        </Field>
        <Field label="color">
          <select
            className="nrpg-select"
            value={color}
            onChange={(e) => setColor(e.currentTarget.value)}
          >
            {Object.keys(colors).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </NodeBody>
    </NodeCard>
  );
}
