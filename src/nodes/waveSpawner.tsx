import { Handle, NodeProps, Position, useEdges, useNodes, useReactFlow } from "@xyflow/react";
import {
  Actor,
  Animation,
  AnimationStrategy,
  CollisionType,
  Color,
  MotionComponent,
  vec,
} from "excalibur";
import { useEffect, useRef } from "preact/hooks";
import { Field, NodeBody, NodeCard, NodeHeader } from "../ui";
import { useGame } from "../App";
import { HealthComponent } from "./modifiers/ecs";
import {
  applyTags,
  collisionGroupForTags,
  emit,
  getSpritesheet,
  on,
  setWaveInfo,
  useAssetVersion,
} from "./modifiers/shared";

// Wave Spawner: spawns a configurable number of escalating waves of creeps
// into its scene, each wave with more / faster / tougher enemies. Creeps
// follow the level's path (waypoints from a referenced tiledMap's
// `pathWaypoints`, edited visually there) and damage the base at the end.
// Towers kill them via their HealthComponent (shared tower logic).
//
// Flow: on `startEvent` (e.g. the state machine's "attack-phase") it spawns the
// current wave into the active scene. When the wave is fully resolved it emits
// `waveClearedEvent` (loop back to build for the next wave) — until the last
// wave, when it emits `levelClearedEvent` instead (advance the scene).

type Pt = { x: number; y: number };
// `key` is set when the creep is a clone of a connected enemy Actor node — it's
// the `${enemyNodeId}__inst-<uid>` entity key the creep is registered under so
// the prefab's child modifiers (animation / sprite) attach via useParentActors.
type Creep = { actor: Actor; idx: number; startAt: number; speed: number; key?: string };

const COLORS: Record<string, Color> = {
  red: Color.Red,
  green: Color.Green,
  blue: Color.Blue,
  yellow: Color.Yellow,
  white: Color.White,
  gray: Color.Gray,
  black: Color.Black,
  orange: Color.Orange,
};

export default function WaveSpawnerNode({ id, data }: NodeProps) {
  const reactFlow = useReactFlow();
  const game = useGame();
  const allNodes = useNodes();
  const edges = useEdges();
  const assetVersion = useAssetVersion();

  // The enemy "prefab": an Actor node wired *into* this spawner. Each creep is
  // a clone of it — appearance, size, tags and collision come from the node,
  // and its child modifiers (animation / sprite) attach to every spawned creep
  // because we register them under the node's `${id}__inst-` entity keys.
  // (HP / speed / count escalation stays on the spawner, below.) When nothing
  // is connected we fall back to the inline enemySheet/enemyFrames look.
  const inEdge = edges.find((e) => e.target === id);
  const enemyNode = inEdge
    ? allNodes.find((n) => n.id === inEdge.source && n.type === "actor")
    : undefined;
  const enemyNodeId = enemyNode?.id;
  const enemyTags = (enemyNode?.data?.tags as string[] | undefined) ?? [];
  const enemyColorName = enemyNode?.data?.color as string | undefined;
  const enemyCollision = (enemyNode?.data?.collision as boolean | undefined) ?? false;
  const enemyNodeW = enemyNode?.data?.width as number | undefined;
  const enemyNodeH = enemyNode?.data?.height as number | undefined;
  const enemyKey = JSON.stringify([enemyNodeId, enemyTags, enemyColorName, enemyCollision, enemyNodeW, enemyNodeH]);

  // Which scene this spawner runs in. Preferred: an outgoing edge to a
  // scene-* node (drag a wire from the spawner to the scene, like Actors do).
  // Falls back to the legacy `sceneId` text field for older graphs.
  const sceneEdge = edges.find((e) => e.source === id && e.target.startsWith("scene-"));
  const sceneId = sceneEdge?.target ?? ((data.sceneId as string | undefined) ?? "");
  const pathFrom = (data.pathFrom as string | undefined) ?? "";
  const enemySheet = (data.enemySheet as string | undefined) ?? "";
  const enemyFrames = (data.enemyFrames as number[] | undefined) ?? [0, 4, 8, 12];
  const enemyW = (data.enemyW as number | undefined) ?? 16;
  const enemyH = (data.enemyH as number | undefined) ?? 16;
  const waves = (data.waves as number | undefined) ?? 3;
  const count0 = (data.count0 as number | undefined) ?? 5;
  const countAdd = (data.countAdd as number | undefined) ?? 3;
  const hp0 = (data.hp0 as number | undefined) ?? 3;
  const hpAdd = (data.hpAdd as number | undefined) ?? 1;
  const speed0 = (data.speed0 as number | undefined) ?? 42;
  const speedAdd = (data.speedAdd as number | undefined) ?? 8;
  const staggerMs = (data.staggerMs as number | undefined) ?? 850;
  const baseTag = (data.baseTag as string | undefined) ?? "base";
  const baseDamage = (data.baseDamage as number | undefined) ?? 1;
  const gameOverEvent = (data.gameOverEvent as string | undefined) ?? "td-game-over";
  const startEvent = (data.startEvent as string | undefined) ?? "attack-phase";
  const waveClearedEvent = (data.waveClearedEvent as string | undefined) ?? "wave-cleared";
  const levelClearedEvent = (data.levelClearedEvent as string | undefined) ?? "level-cleared";

  // Resolve waypoints from the referenced tiledMap (visual editor) or inline.
  const srcNode = pathFrom ? allNodes.find((n) => n.id === pathFrom) : undefined;
  const waypoints =
    ((srcNode?.data?.pathWaypoints as Pt[] | undefined) ??
      (data.waypoints as Pt[] | undefined) ??
      []) as Pt[];
  const wpKey = JSON.stringify(waypoints);

  const waveRef = useRef(0);
  const creepsRef = useRef<Creep[]>([]);
  const wasActiveRef = useRef(false);
  const spawnSeqRef = useRef(0);

  useEffect(() => {
    if (waypoints.length < 2) return;
    const start = waypoints[0];
    const engine: any = game.engine;
    const sceneActive = () => {
      if (!engine) return false;
      const cur = engine.currentSceneName ?? engine.currentScene;
      return sceneId ? cur === sceneId || engine.currentScene?.name === sceneId : true;
    };

    const buildAnim = () => {
      const sheet = enemySheet ? getSpritesheet(enemySheet) : undefined;
      if (!sheet) return undefined;
      const frames = enemyFrames
        .map((i) => sheet.sprites[i])
        .filter(Boolean)
        .map((g) => ({ graphic: g.clone(), duration: 160 }));
      return frames.length ? new Animation({ frames, strategy: AnimationStrategy.Loop }) : undefined;
    };

    // Tags applied to every creep — the prefab's tags plus "enemy" (towers
    // target by that tag), deduped. Falls back to plain "enemy" with no prefab.
    const creepTags = Array.from(
      new Set([...(enemyNodeId ? enemyTags : []), "enemy"]),
    );
    const creepColor = enemyColorName ? COLORS[enemyColorName] ?? Color.Red : Color.Red;
    const creepW = enemyNodeW ?? enemyW;
    const creepH = enemyNodeH ?? enemyH;

    const spawnWave = (w: number) => {
      const scene = engine?.currentScene;
      if (!scene) return;
      const n = count0 + w * countAdd;
      const hp = hp0 + w * hpAdd;
      const speed = speed0 + w * speedAdd;
      const registered: Array<[string, Actor]> = [];
      for (let i = 0; i < n; i++) {
        const a = new Actor({
          pos: vec(start.x, start.y),
          width: creepW,
          height: creepH,
          color: creepColor,
          collisionType:
            enemyNodeId && enemyCollision
              ? CollisionType.Active
              : CollisionType.PreventCollision,
        });
        applyTags(a, creepTags);
        // HP is owned by the spawner so it can escalate per wave; that's why the
        // enemy prefab carries no healthModifier (it would stomp this value).
        a.addComponent(new HealthComponent(hp, "kill"));
        const group = collisionGroupForTags(creepTags);
        if (group && a.body) a.body.group = group;
        let key: string | undefined;
        if (enemyNodeId) {
          // Register under the prefab's instance namespace so its child
          // modifiers (animation, sprite, …) attach to this creep too.
          key = `${enemyNodeId}__inst-wave-${performance.now().toString(36)}-${spawnSeqRef.current++}`;
          registered.push([key, a]);
        } else {
          // No prefab wired — use the inline spritesheet animation.
          const anim = buildAnim();
          if (anim) a.graphics.use(anim);
        }
        try {
          (a as any).graphics.opacity = 0;
        } catch {}
        scene.add(a);
        creepsRef.current.push({ actor: a, idx: 1, startAt: performance.now() + i * staggerMs, speed, key });
      }
      if (registered.length) {
        game.setEntities((prev) => {
          const next = { ...prev };
          for (const [k, a] of registered) next[k] = a;
          return next;
        });
      }
      setWaveInfo(`Wave ${w + 1}/${waves}`);
    };

    const unregister = (keys: string[]) => {
      if (!keys.length) return;
      game.setEntities((prev) => {
        const next = { ...prev };
        for (const k of keys) delete next[k];
        return next;
      });
    };

    const clearCreeps = () => {
      const keys = creepsRef.current.map((c) => c.key).filter(Boolean) as string[];
      for (const c of creepsRef.current) {
        try {
          c.actor.kill();
        } catch {}
      }
      creepsRef.current = [];
      unregister(keys);
    };

    let gameOverSent = false;
    const onStart = on(startEvent.trim(), () => {
      if (sceneActive() && creepsRef.current.length === 0 && waveRef.current < waves) {
        spawnWave(waveRef.current);
      }
    });

    const intv = setInterval(() => {
      const active = sceneActive();
      // Re-arm the level when (re)entered.
      if (active && !wasActiveRef.current) {
        waveRef.current = 0;
        clearCreeps();
      }
      wasActiveRef.current = active;
      if (!active) return;

      const now = performance.now();
      const creeps = creepsRef.current;
      if (creeps.length === 0) return;
      let resolved = 0;
      for (const c of creeps) {
        if (c.actor.isKilled?.()) {
          resolved++;
          continue;
        }
        if (now < c.startAt) continue;
        try {
          (c.actor as any).graphics.opacity = 1;
        } catch {}
        const target = waypoints[c.idx];
        const motion = c.actor.get(MotionComponent);
        if (!target) continue;
        const dx = target.x - c.actor.pos.x;
        const dy = target.y - c.actor.pos.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= Math.max(2, (c.speed / 60) * 1.5)) {
          c.actor.pos = vec(target.x, target.y);
          c.idx++;
          if (c.idx >= waypoints.length) {
            const base = c.actor.scene?.actors.find((o) => o.hasTag(baseTag));
            const bhp = base?.get(HealthComponent);
            if (bhp) {
              bhp.current = Math.max(0, bhp.current - baseDamage);
              if (bhp.current <= 0 && !gameOverSent && gameOverEvent.trim()) {
                gameOverSent = true;
                emit(gameOverEvent.trim(), { base }, id);
              }
            }
            try {
              c.actor.kill();
            } catch {}
            resolved++;
          }
        } else if (motion) {
          motion.vel = vec((dx / dist) * c.speed, (dy / dist) * c.speed);
        }
      }
      // Whole wave resolved → next wave, or level cleared after the last.
      if (resolved >= creeps.length) {
        unregister(creeps.map((c) => c.key).filter(Boolean) as string[]);
        creepsRef.current = [];
        waveRef.current++;
        if (waveRef.current < waves) {
          if (waveClearedEvent.trim()) emit(waveClearedEvent.trim(), { wave: waveRef.current }, id);
        } else {
          if (levelClearedEvent.trim()) emit(levelClearedEvent.trim(), {}, id);
        }
      }
    }, 1000 / 60);

    return () => {
      onStart();
      clearInterval(intv);
      clearCreeps();
    };
  }, [wpKey, sceneId, enemyKey, enemySheet, JSON.stringify(enemyFrames), waves, count0, countAdd, hp0, hpAdd, speed0, speedAdd, staggerMs, baseTag, baseDamage, startEvent, waveClearedEvent, levelClearedEvent, gameOverEvent, game.engine, game.resetTick, game.setEntities, assetVersion]);

  const set = (k: string, v: any) => reactFlow.updateNodeData(id, { [k]: v });
  const num = (label: string, k: string, val: number) => (
    <Field label={label}>
      <input type="number" className="nrpg-input" value={val}
        onChange={(e) => set(k, +e.currentTarget.value)} />
    </Field>
  );

  return (
    <NodeCard accent="entity" style={{ minWidth: 250 }}>
      <NodeHeader
        title={(data.label as string) ?? "Wave Spawner"}
        subtitle="waves"
        accent="entity"
        onTitleChange={(v) => reactFlow.updateNodeData(id, { label: v })}
      />
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <NodeBody>
        <div style={{ fontSize: 10, color: enemyNode ? "var(--text-muted)" : "var(--text-subtle)" }}>
          {enemyNode
            ? `enemy: ${(enemyNode.data?.label as string) ?? enemyNode.id}`
            : "enemy: (connect an Actor node →)"}
        </div>
        {sceneEdge ? (
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
            scene: {(allNodes.find((n) => n.id === sceneEdge.target)?.data?.label as string) ?? sceneEdge.target}
          </div>
        ) : (
          <Field label="scene id">
            <input type="text" className="nrpg-input" style={{ width: 120, textAlign: "left" }}
              value={sceneId} onChange={(e) => set("sceneId", e.currentTarget.value)}
              placeholder="(or wire to a scene →)" />
          </Field>
        )}
        <Field label="path from">
          <select className="nrpg-select" value={pathFrom} onChange={(e) => set("pathFrom", e.currentTarget.value)}>
            <option value="">(inline)</option>
            {allNodes.filter((n) => n.type === "tiledMap").map((n) => (
              <option key={n.id} value={n.id}>{((n.data?.label as string) ?? n.id)}</option>
            ))}
          </select>
        </Field>
        {num("waves", "waves", waves)}
        {num("count (wave 1)", "count0", count0)}
        {num("+count / wave", "countAdd", countAdd)}
        {num("hp (wave 1)", "hp0", hp0)}
        {num("+hp / wave", "hpAdd", hpAdd)}
        {num("speed (wave 1)", "speed0", speed0)}
        {num("+speed / wave", "speedAdd", speedAdd)}
        <div style={{ fontSize: 10, color: "var(--text-subtle)" }}>
          {waypoints.length} waypoints{srcNode ? " (from map)" : ""}
        </div>
      </NodeBody>
    </NodeCard>
  );
}
