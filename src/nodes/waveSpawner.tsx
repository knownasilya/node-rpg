import { Handle, NodeProps, Position, useNodes, useReactFlow } from "@xyflow/react";
import {
  Actor,
  Animation,
  AnimationStrategy,
  CollisionType,
  MotionComponent,
  vec,
} from "excalibur";
import { useEffect, useRef } from "preact/hooks";
import { Field, NodeBody, NodeCard, NodeHeader } from "../ui";
import { useGame } from "../App";
import { HealthComponent } from "./modifiers/ecs";
import {
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
type Creep = { actor: Actor; idx: number; startAt: number; speed: number };

export default function WaveSpawnerNode({ id, data }: NodeProps) {
  const reactFlow = useReactFlow();
  const game = useGame();
  const allNodes = useNodes();
  const assetVersion = useAssetVersion();

  const sceneId = (data.sceneId as string | undefined) ?? "";
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

    const spawnWave = (w: number) => {
      const scene = engine?.currentScene;
      if (!scene) return;
      const n = count0 + w * countAdd;
      const hp = hp0 + w * hpAdd;
      const speed = speed0 + w * speedAdd;
      for (let i = 0; i < n; i++) {
        const a = new Actor({
          pos: vec(start.x, start.y),
          width: enemyW,
          height: enemyH,
          collisionType: CollisionType.PreventCollision,
        });
        a.addTag("enemy");
        a.addComponent(new HealthComponent(hp, "kill"));
        const anim = buildAnim();
        if (anim) a.graphics.use(anim);
        try {
          (a as any).graphics.opacity = 0;
        } catch {}
        scene.add(a);
        creepsRef.current.push({ actor: a, idx: 1, startAt: performance.now() + i * staggerMs, speed });
      }
      setWaveInfo(`Wave ${w + 1}/${waves}`);
    };

    const clearCreeps = () => {
      for (const c of creepsRef.current) {
        try {
          c.actor.kill();
        } catch {}
      }
      creepsRef.current = [];
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
                emit(gameOverEvent.trim(), { base });
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
        creepsRef.current = [];
        waveRef.current++;
        if (waveRef.current < waves) {
          if (waveClearedEvent.trim()) emit(waveClearedEvent.trim(), { wave: waveRef.current });
        } else {
          if (levelClearedEvent.trim()) emit(levelClearedEvent.trim(), {});
        }
      }
    }, 1000 / 60);

    return () => {
      onStart();
      clearInterval(intv);
      clearCreeps();
    };
  }, [wpKey, sceneId, enemySheet, JSON.stringify(enemyFrames), waves, count0, countAdd, hp0, hpAdd, speed0, speedAdd, staggerMs, baseTag, baseDamage, startEvent, waveClearedEvent, levelClearedEvent, gameOverEvent, game.engine, game.resetTick, assetVersion]);

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
      <Handle type="source" position={Position.Right} />
      <NodeBody>
        <Field label="scene id">
          <input type="text" className="nrpg-input" style={{ width: 120, textAlign: "left" }}
            value={sceneId} onChange={(e) => set("sceneId", e.currentTarget.value)} />
        </Field>
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
