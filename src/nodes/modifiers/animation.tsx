import { NodeProps, useNodes, useReactFlow } from "@xyflow/react";
import {
  Component,
  MotionComponent,
  Query,
  System,
  SystemType,
  World,
} from "excalibur";
import { useEffect, useState } from "preact/hooks";
import { Field, ModShell, Toggle } from "../../ui";
import {
  GroundedComponent,
  RequestedHeadingComponent,
} from "./ecs";
import {
  getAnimation,
  useAssetVersion,
  useParentActors,
} from "./shared";

// Animation modifier: hold a state-map from named platformer states
// ("idle" / "run" / "jump" / "fall") to Animation node ids. The selector
// system below picks the right state each tick from grounded + velocity,
// then `actor.graphics.use(anim)`s it. If the user wires only a subset of
// states, the others fall back to "idle".

type State = "idle" | "run" | "jump" | "fall" | "attack" | "hurt" | "death";
const STATES: State[] = [
  "idle",
  "run",
  "jump",
  "fall",
  "attack",
  "hurt",
  "death",
];
// States that are normally selected automatically from motion. Combat
// states (attack/hurt/death) are only entered via pinning.
type AutoState = "idle" | "run" | "jump" | "fall";

class AnimationComponent extends Component {
  // `current` doubles as a "what's been applied?" flag — start empty so
  // the very first selector tick always falls through to graphics.use.
  current: State | "" = "";
  // The animation node id that was last actually applied to graphics. Lets
  // the selector skip redundant use() calls without losing the first-apply.
  appliedKey: string = "";
  appliedFlip: boolean = false;
  facing: "left" | "right" = "right";
  // Default-direction state map. Left-direction overrides are optional;
  // when set for a state they're used verbatim and we don't mirror.
  states: Partial<Record<State, string>>;
  statesLeft: Partial<Record<State, string>>;
  flipOnDirection: boolean;
  // Pinned state override — a transient state forced by some external
  // event (AttackModifier sets "attack"; HurtboxSystem sets "hurt";
  // HealthComponent.onZero sets "death"). The selector uses `state` until
  // `until` (in performance.now()) and then falls back to motion-driven
  // states. `until: Infinity` means a permanent pin (used for death).
  pinned?: { state: State; until: number };
  constructor(
    states: Partial<Record<State, string>>,
    statesLeft: Partial<Record<State, string>> = {},
    flipOnDirection: boolean = false,
  ) {
    super();
    this.states = states;
    this.statesLeft = statesLeft;
    this.flipOnDirection = flipOnDirection;
  }
  pin(state: State, durationMs: number): void {
    this.pinned = {
      state,
      until: durationMs === Infinity ? Infinity : performance.now() + durationMs,
    };
  }
  // Cleanup expired pin so the next tick falls back to motion-driven state.
  pollPin(): void {
    if (this.pinned && this.pinned.until <= performance.now()) {
      this.pinned = undefined;
    }
  }
}

class AnimationSelectorSystem extends System {
  static priority = 95;
  systemType = SystemType.Update;
  query: Query<typeof AnimationComponent>;
  constructor(public world: World) {
    super();
    this.query = world.query([AnimationComponent]);
  }
  update(): void {
    for (const e of this.query.entities) {
      const ac = e.get(AnimationComponent);
      const grounded = e.get(GroundedComponent);
      const motion = e.get(MotionComponent);
      const heading = e.get(RequestedHeadingComponent);
      if (!ac) continue;
      ac.pollPin();
      const onGround = grounded?.isGrounded ?? true;
      const vy = motion?.vel.y ?? 0;
      const vx = motion?.vel.x ?? 0;
      const headingX = heading?.heading.x ?? 0;
      const movingX = Math.abs(vx) > 1 || headingX !== 0;
      // Update facing direction. Prefer input heading; fall back to vel.
      const dir =
        headingX !== 0
          ? Math.sign(headingX)
          : Math.abs(vx) > 1
            ? Math.sign(vx)
            : 0;
      if (dir !== 0) ac.facing = dir < 0 ? "left" : "right";

      // Pinned state takes precedence — used by AttackModifier / Hurtbox
      // / Health to force "attack" / "hurt" / "death" for a window even
      // while the player is otherwise moving normally.
      let next: State;
      if (ac.pinned) {
        next = ac.pinned.state;
      } else {
        let auto: AutoState;
        if (onGround) {
          auto = movingX ? "run" : "idle";
        } else {
          auto = vy < 0 ? "jump" : "fall";
        }
        next = auto;
      }

      // Pick the right key for the facing direction:
      //   * If a left-facing override is wired for this state and we're
      //     facing left, use it directly (no flip).
      //   * Otherwise use the default map and, when flipOnDirection is on,
      //     mirror via actor.graphics.flipHorizontal.
      const leftOverride =
        ac.facing === "left" ? ac.statesLeft?.[next] : undefined;
      const key = leftOverride || ac.states[next] || ac.states.idle;
      if (!key) continue;
      const anim = getAnimation(key);
      if (!anim) continue;
      const shouldFlip =
        !leftOverride && ac.facing === "left" && ac.flipOnDirection;

      if (
        key === ac.appliedKey &&
        next === ac.current &&
        shouldFlip === ac.appliedFlip
      ) {
        continue;
      }
      try {
        const graphics = (e as any).graphics;
        graphics?.use?.(anim);
        if (graphics) graphics.flipHorizontal = shouldFlip;
        ac.current = next;
        ac.appliedKey = key;
        ac.appliedFlip = shouldFlip;
      } catch {}
    }
  }
}

// Lazy-register this system at module load — when scene.tsx calls
// registerEcsSystems, this system gets included via the registry below.
// To avoid altering registerEcsSystems' signature, we wedge into Scene's
// world via a Scene.on hook when first used.
const REGISTERED_SCENES = new WeakSet<object>();
function ensureSelectorSystem(actor: any): void {
  const scene = actor?.scene;
  if (!scene || REGISTERED_SCENES.has(scene)) return;
  try {
    scene.world.add(AnimationSelectorSystem);
    REGISTERED_SCENES.add(scene);
  } catch {}
}

// Called from scene.tsx as soon as the Scene is constructed so the
// selector runs from frame 1. Without this, an Actor that's added to
// the scene AFTER its animation modifier first ran (e.g. .tmj-projected
// slimes / coins) had no AnimationSelectorSystem on the scene and the
// sprite/animation never applied — the actor stayed a colored rect.
export function registerAnimationSelectorSystem(scene: any): void {
  if (!scene || REGISTERED_SCENES.has(scene)) return;
  try {
    scene.world.add(AnimationSelectorSystem);
    REGISTERED_SCENES.add(scene);
  } catch {}
}

export default function AnimationModifier({ id, data, parentId }: NodeProps) {
  const reactFlow = useReactFlow();
  const actors = useParentActors(parentId);
  // Stable key so deps don't change every render (array identity flips).
  const actorsKey = actors.map((a) => a.id).join(",");
  const allNodes = useNodes();
  const animationNodes = allNodes.filter((n) => n.type === "animation");

  const initial = (data.states as Partial<Record<State, string>>) ?? {};
  const initialLeft =
    (data.statesLeft as Partial<Record<State, string>>) ?? {};
  const [states, setStates] = useState<Partial<Record<State, string>>>(
    Object.fromEntries(STATES.map((s) => [s, initial[s] ?? ""])),
  );
  const [statesLeft, setStatesLeft] = useState<Partial<Record<State, string>>>(
    Object.fromEntries(STATES.map((s) => [s, initialLeft[s] ?? ""])),
  );
  const updateState = (s: State, value: string, left: boolean) => {
    if (left) {
      setStatesLeft((prev) => {
        const next = { ...prev, [s]: value };
        reactFlow.updateNodeData(id, { statesLeft: next });
        return next;
      });
    } else {
      setStates((prev) => {
        const next = { ...prev, [s]: value };
        reactFlow.updateNodeData(id, { states: next });
        return next;
      });
    }
  };
  const statesKey =
    JSON.stringify(states) + "|" + JSON.stringify(statesLeft);
  const [flipOnDirection, setFlipOnDirection] = useState<boolean>(
    (data.flipOnDirection as boolean | undefined) ?? false,
  );
  const [showLeftOverrides, setShowLeftOverrides] = useState<boolean>(
    (data.showLeftOverrides as boolean | undefined) ?? false,
  );

  const assetVersion = useAssetVersion();

  useEffect(() => {
    if (actors.length === 0) return;
    // Drop empty-string entries before passing to the component so the
    // selector's fallback to states.idle works.
    const cleanedStates: Partial<Record<State, string>> = {};
    const cleanedLeft: Partial<Record<State, string>> = {};
    for (const s of STATES) {
      if (states[s]) cleanedStates[s] = states[s];
      if (statesLeft[s]) cleanedLeft[s] = statesLeft[s];
    }
    for (const a of actors) {
      ensureSelectorSystem(a);
      const existing = a.get(AnimationComponent);
      if (existing) {
        existing.states = cleanedStates;
        existing.statesLeft = cleanedLeft;
        existing.flipOnDirection = flipOnDirection;
      } else {
        a.addComponent(
          new AnimationComponent(cleanedStates, cleanedLeft, flipOnDirection),
        );
      }
    }
    return () => {
      for (const a of actors) {
        if (a.get(AnimationComponent)) {
          a.removeComponent(AnimationComponent);
        }
      }
    };
  }, [actorsKey, statesKey, flipOnDirection, assetVersion]);

  const valueFor = (s: State, left: boolean) =>
    left ? statesLeft[s] ?? "" : states[s] ?? "";

  const wiredStates = STATES.filter((s) => states[s]);
  const summary =
    wiredStates.length === 0 ? "(no states)" : wiredStates.join(", ");
  return (
    <ModShell
      id={id}
      data={data}
      accent="var(--accent-entity)"
      title="Animation"
      summary={summary}
    >
        {STATES.map((s) => (
          <Field key={s} label={s}>
            <select
              className="nrpg-select"
              value={valueFor(s, false)}
              onChange={(e) => updateState(s, e.currentTarget.value, false)}
            >
              <option value="">(none)</option>
              {animationNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {((n.data?.label as string | undefined) ?? n.id) +
                    ` — ${n.id}`}
                </option>
              ))}
            </select>
          </Field>
        ))}
        <Toggle
          label="flip on dir"
          checked={flipOnDirection}
          onChange={setFlipOnDirection}
        />
        <Toggle
          label="left overrides"
          checked={showLeftOverrides}
          onChange={setShowLeftOverrides}
        />
        {showLeftOverrides && (
          <>
            <div
              style={{
                fontSize: 10,
                color: "var(--text-subtle)",
                marginTop: 2,
              }}
            >
              left-facing (used instead of flipping)
            </div>
            {STATES.map((s) => (
              <Field key={`${s}-left`} label={`${s} ←`}>
                <select
                  className="nrpg-select"
                  value={valueFor(s, true)}
                  onChange={(e) => updateState(s, e.currentTarget.value, true)}
                >
                  <option value="">(use flip)</option>
                  {animationNodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {((n.data?.label as string | undefined) ?? n.id) +
                        ` — ${n.id}`}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </>
        )}
    </ModShell>
  );
}

// Export so collision-rule's playAnimation action can find this component
// type if needed by external systems. (Currently the rule looks up the
// animation directly from the asset registry by key.)
export { AnimationComponent as PlayerAnimationStateComponent };
