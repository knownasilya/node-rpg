import { NodeProps, useNodes, useReactFlow } from "@xyflow/react";
import {
  Animation,
  AnimationStrategy,
  Component,
  MotionComponent,
  Query,
  Sprite,
  SpriteSheet,
  System,
  SystemType,
  World,
} from "excalibur";
import { useEffect, useState } from "preact/hooks";
import { Field, ModShell } from "../../ui";
import { RequestedHeadingComponent } from "./ecs";
import { getSpritesheet, on, useAssetVersion, useParentActors } from "./shared";

// Top-down 4-directional animation. Unlike the platformer-oriented
// AnimationModifier (idle/run with left/right flip), this picks a facing —
// down / up / left / right — from the actor's requested heading (falling back
// to velocity) and shows the matching graphic:
//   * moving  -> the walk row for that facing (built straight from the sheet)
//   * idle    -> the idle frame for that facing (or the walk row if no idle sheet)
//   * attack  -> the attack frame for that facing, pinned for a window when the
//                configured event fires (e.g. "player-attacked").
//
// Sheet frame convention (matches the public/adventure SeparateAnim sheets):
//   each DIRECTION is a COLUMN: col 0 down, 1 up, 2 left, 3 right.
//   idle / attack sheet: 1 row  -> one frame per direction (the 4 columns).
//   walk sheet:          N rows -> each row is a walk-cycle frame; the column
//                        picks the facing. So walk-down = column 0 down every row.

const DOWN = 0;
const UP = 1;
const LEFT = 2;
const RIGHT = 3;

type DirectionAxis = "column" | "row";

class DirectionalAnimationComponent extends Component {
  idleSheetId = "";
  walkSheetId = "";
  attackSheetId = "";
  // Which axis of the WALK sheet holds the 4 facings. "column": each
  // direction is a column and rows are the walk frames (adventure pack).
  // "row": each direction is a row and columns are the walk frames.
  directionAxis: DirectionAxis = "column";
  frameDurationMs = 120;
  attackMs = 250;
  facing = DOWN;
  pinnedUntil = 0;
  // Lazily built per (sheet ids + duration) cache.
  _builtKey = "";
  _idle?: Sprite[];
  _walk?: Animation[];
  _attack?: Sprite[];
  _appliedKey = "";

  pinAttack(): void {
    this.pinnedUntil = performance.now() + this.attackMs;
  }
}

function colsOf(sheet: SpriteSheet): number {
  return (sheet as any).columns ?? Math.max(1, Math.floor(sheet.sprites.length / 4));
}

class DirectionalAnimationSystem extends System {
  static priority = 95;
  systemType = SystemType.Update;
  query: Query<typeof DirectionalAnimationComponent>;
  constructor(public world: World) {
    super();
    this.query = world.query([DirectionalAnimationComponent]);
  }
  update(): void {
    for (const e of this.query.entities) {
      const dc = e.get(DirectionalAnimationComponent);
      if (!dc) continue;

      // (Re)build the sprite/animation cache when sheet selection changes
      // and the required walk sheet is loaded.
      const key = `${dc.idleSheetId}|${dc.walkSheetId}|${dc.attackSheetId}|${dc.frameDurationMs}|${dc.directionAxis}`;
      if (dc._builtKey !== key) {
        const walk = dc.walkSheetId ? getSpritesheet(dc.walkSheetId) : undefined;
        if (walk) {
          const cols = colsOf(walk);
          const rows = Math.max(1, Math.floor(walk.sprites.length / cols));
          dc._walk = [DOWN, UP, LEFT, RIGHT].map((dir) => {
            const frames = [];
            if (dc.directionAxis === "column") {
              // Direction = column; each row is a walk-cycle frame.
              for (let r = 0; r < rows; r++) {
                const sprite = walk.sprites[r * cols + dir];
                if (sprite) frames.push({ graphic: sprite, duration: dc.frameDurationMs });
              }
            } else {
              // Direction = row; each column is a walk-cycle frame.
              for (let c = 0; c < cols; c++) {
                const sprite = walk.sprites[dir * cols + c];
                if (sprite) frames.push({ graphic: sprite, duration: dc.frameDurationMs });
              }
            }
            return new Animation({ frames, strategy: AnimationStrategy.Loop });
          });
          // Idle / attack sheets are a single row -> one frame per direction
          // (the 4 columns), indexed directly by facing.
          const idle = dc.idleSheetId ? getSpritesheet(dc.idleSheetId) : undefined;
          dc._idle = idle ? [0, 1, 2, 3].map((i) => idle.sprites[i]) : undefined;
          const atk = dc.attackSheetId ? getSpritesheet(dc.attackSheetId) : undefined;
          dc._attack = atk ? [0, 1, 2, 3].map((i) => atk.sprites[i]) : undefined;
          dc._builtKey = key;
          dc._appliedKey = "";
        }
      }
      if (!dc._walk) continue;

      const heading = e.get(RequestedHeadingComponent)?.heading;
      const vel = e.get(MotionComponent)?.vel;
      const hx = heading?.x ?? 0;
      const hy = heading?.y ?? 0;
      const vx = vel?.x ?? 0;
      const vy = vel?.y ?? 0;
      const dx = hx !== 0 ? hx : Math.abs(vx) > 1 ? vx : 0;
      const dy = hy !== 0 ? hy : Math.abs(vy) > 1 ? vy : 0;
      const moving = dx !== 0 || dy !== 0;

      if (moving) {
        if (Math.abs(dx) > Math.abs(dy)) dc.facing = dx < 0 ? LEFT : RIGHT;
        else dc.facing = dy < 0 ? UP : DOWN;
      }

      let mode: "attack" | "walk" | "idle";
      if (dc._attack && performance.now() < dc.pinnedUntil) mode = "attack";
      else if (moving) mode = "walk";
      else mode = "idle";

      const appliedKey = `${mode}:${dc.facing}`;
      if (appliedKey === dc._appliedKey) continue;

      let graphic: Sprite | Animation | undefined;
      if (mode === "attack") graphic = dc._attack?.[dc.facing];
      else if (mode === "walk") graphic = dc._walk[dc.facing];
      else graphic = dc._idle ? dc._idle[dc.facing] : dc._walk[dc.facing];
      if (!graphic) continue;

      try {
        const graphics = (e as any).graphics;
        // Reset animations so a re-shown direction starts from frame 0.
        if (graphic instanceof Animation) graphic.reset();
        graphics?.use?.(graphic);
        if (graphics) graphics.flipHorizontal = false;
        dc._appliedKey = appliedKey;
      } catch {}
    }
  }
}

const REGISTERED_SCENES = new WeakSet<object>();
export function registerDirectionalAnimationSystem(scene: any): void {
  if (!scene || REGISTERED_SCENES.has(scene)) return;
  try {
    scene.world.add(DirectionalAnimationSystem);
    REGISTERED_SCENES.add(scene);
  } catch {}
}
function ensureSystem(actor: any): void {
  registerDirectionalAnimationSystem(actor?.scene);
}

export default function DirectionalAnimationModifier({
  id,
  data,
  parentId,
}: NodeProps) {
  const reactFlow = useReactFlow();
  const actors = useParentActors(parentId);
  const actorsKey = actors.map((a) => a.id).join(",");
  const allNodes = useNodes();
  const sheetNodes = allNodes.filter((n) => n.type === "spritesheet");
  const assetVersion = useAssetVersion();

  const [idleSheet, setIdleSheet] = useState<string>(
    (data.idleSheet as string | undefined) ?? "",
  );
  const [walkSheet, setWalkSheet] = useState<string>(
    (data.walkSheet as string | undefined) ?? "",
  );
  const [attackSheet, setAttackSheet] = useState<string>(
    (data.attackSheet as string | undefined) ?? "",
  );
  const [directionAxis, setDirectionAxis] = useState<DirectionAxis>(
    (data.directionAxis as DirectionAxis | undefined) ?? "column",
  );
  const [frameDurationMs, setFrameDurationMs] = useState<number>(
    (data.frameDurationMs as number | undefined) ?? 120,
  );
  const [attackEvent, setAttackEvent] = useState<string>(
    (data.attackEvent as string | undefined) ?? "",
  );
  const [attackMs, setAttackMs] = useState<number>(
    (data.attackMs as number | undefined) ?? 250,
  );

  const update = (patch: Record<string, unknown>) =>
    reactFlow.updateNodeData(id, patch);

  useEffect(() => {
    if (actors.length === 0) return;
    for (const a of actors) {
      ensureSystem(a);
      let c = a.get(DirectionalAnimationComponent);
      if (!c) {
        c = new DirectionalAnimationComponent();
        a.addComponent(c);
      }
      c.idleSheetId = idleSheet;
      c.walkSheetId = walkSheet;
      c.attackSheetId = attackSheet;
      c.directionAxis = directionAxis;
      c.frameDurationMs = frameDurationMs;
      c.attackMs = attackMs;
      c._builtKey = ""; // force rebuild against latest selection
    }
    return () => {
      for (const a of actors) {
        if (a.get(DirectionalAnimationComponent)) {
          a.removeComponent(DirectionalAnimationComponent);
        }
      }
    };
  }, [actorsKey, idleSheet, walkSheet, attackSheet, directionAxis, frameDurationMs, attackMs, assetVersion]);

  // Pin the attack pose when the configured event fires.
  useEffect(() => {
    const name = attackEvent.trim();
    if (!name || actors.length === 0) return;
    const unsub = on(name, () => {
      for (const a of actors) a.get(DirectionalAnimationComponent)?.pinAttack();
    });
    return unsub;
  }, [actorsKey, attackEvent]);

  const sheetOptions = (value: string, onChange: (v: string) => void) => (
    <select
      className="nrpg-select"
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
    >
      <option value="">(none)</option>
      {sheetNodes.map((n) => (
        <option key={n.id} value={n.id}>
          {((n.data?.label as string | undefined) ?? n.id) + ` — ${n.id}`}
        </option>
      ))}
    </select>
  );

  return (
    <ModShell
      id={id}
      data={data}
      accent="var(--accent-entity)"
      title="Directional Anim"
      summary="down/up/left/right"
    >
      <Field label="idle sheet">
        {sheetOptions(idleSheet, (v) => {
          setIdleSheet(v);
          update({ idleSheet: v });
        })}
      </Field>
      <Field label="walk sheet">
        {sheetOptions(walkSheet, (v) => {
          setWalkSheet(v);
          update({ walkSheet: v });
        })}
      </Field>
      <Field label="attack sheet">
        {sheetOptions(attackSheet, (v) => {
          setAttackSheet(v);
          update({ attackSheet: v });
        })}
      </Field>
      <Field label="dir axis">
        <select
          className="nrpg-select"
          value={directionAxis}
          onChange={(e) => {
            const v = e.currentTarget.value as DirectionAxis;
            setDirectionAxis(v);
            update({ directionAxis: v });
          }}
        >
          <option value="column">column = facing</option>
          <option value="row">row = facing</option>
        </select>
      </Field>
      <Field label="frame ms">
        <input
          type="number"
          min={20}
          className="nrpg-input"
          value={frameDurationMs}
          onChange={(e) => {
            const v = +e.currentTarget.value;
            setFrameDurationMs(v);
            update({ frameDurationMs: v });
          }}
        />
      </Field>
      <Field label="attack event">
        <input
          type="text"
          className="nrpg-input"
          style={{ width: 120, textAlign: "left" }}
          value={attackEvent}
          placeholder="player-attacked"
          onChange={(e) => {
            setAttackEvent(e.currentTarget.value);
            update({ attackEvent: e.currentTarget.value });
          }}
        />
      </Field>
      <Field label="attack ms">
        <input
          type="number"
          min={50}
          className="nrpg-input"
          value={attackMs}
          onChange={(e) => {
            const v = +e.currentTarget.value;
            setAttackMs(v);
            update({ attackMs: v });
          }}
        />
      </Field>
    </ModShell>
  );
}
