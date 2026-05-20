import { emit, on } from "./shared";

// Framework-agnostic state-chart runtime. This is the transition logic that
// used to live inside StateMachineNode's useEffect, lifted out so it can be
// instantiated many times — once globally (the State Machine node) and once
// per actor instance (the State Chart modifier). The "publish current state"
// side effect is injected via `onState`, so the global node can push to the
// HUD store while a per-instance chart writes onto its actor's component.
//
// Data model (additive over the original):
//   StateDef.say   — text shown by a Speech Bubble / Dialog when in this state
//   Transition.label — when present, the transition is a selectable dialog
//                      option (its `event` is what a Dialog button sends).

export type StateDef = {
  name: string;
  hint?: string;
  enterEvent?: string;
  say?: string;
};
export type Transition = {
  from: string;
  to: string;
  event?: string;
  key?: string;
  ms?: number;
  emit?: string;
  label?: string;
};
export type ChartSpec = {
  initial: string;
  resetEvent?: string;
  states: StateDef[];
  transitions: Transition[];
};
export type ChartCallbacks = {
  // Called on every state entry (and on each countdown tick, with the live
  // `· Ns` hint). `def` is the entered state's definition, if any.
  onState?: (name: string, hint: string, def: StateDef | undefined) => void;
  // Optional label recorded in the event log for emits from this chart (e.g.
  // the State Machine node's id), purely for debugging attribution.
  source?: string;
};
export type ChartHandle = {
  current: () => string;
  // Drive a transition on THIS chart instance only (used by the Dialog panel
  // so clicking a button advances one NPC, not every NPC sharing the spec).
  send: (event: string) => void;
  dispose: () => void;
};

export function runChart(spec: ChartSpec, cb?: ChartCallbacks): ChartHandle {
  const { initial, states, transitions } = spec;
  const resetEvent = spec.resetEvent ?? "";
  const onState = cb?.onState;
  const source = cb?.source;

  let currentName = "";
  let disposed = false;
  const cleanups: Array<() => void> = [];
  let countdown: ReturnType<typeof setInterval> | null = null;
  // Per-instance event channel: transitions arm a listener here in addition to
  // the global bus, so `send(event)` can fire them locally without broadcasting.
  const localListeners = new Map<string, Set<() => void>>();
  const localOn = (event: string, fn: () => void): (() => void) => {
    let set = localListeners.get(event);
    if (!set) {
      set = new Set();
      localListeners.set(event, set);
    }
    set.add(fn);
    return () => {
      set!.delete(fn);
      if (set!.size === 0) localListeners.delete(event);
    };
  };

  const stateOf = (name: string) => states.find((s) => s.name === name);

  const enter = (name: string) => {
    if (disposed) return;
    currentName = name;
    const def = stateOf(name);
    const baseHint = def?.hint ?? "";
    onState?.(name, baseHint, def);
    if (def?.enterEvent?.trim()) emit(def.enterEvent.trim(), { state: name }, source);
    // Tear down the previous state's armed triggers.
    while (cleanups.length) cleanups.pop()!();
    if (countdown) {
      clearInterval(countdown);
      countdown = null;
    }
    let moved = false;
    const fire = (t: Transition) => {
      if (moved) return; // first transition to fire wins
      moved = true;
      if (t.emit?.trim()) emit(t.emit.trim(), { from: name, to: t.to }, source);
      enter(t.to);
    };
    const active = transitions.filter((t) => t.from === name || t.from === "*");
    let soonest = Infinity;
    for (const t of active) {
      if (t.key) {
        const h = (e: KeyboardEvent) => {
          if (e.code === t.key || e.key === t.key) fire(t);
        };
        window.addEventListener("keydown", h);
        cleanups.push(() => window.removeEventListener("keydown", h));
      }
      if (t.event?.trim()) {
        const ev = t.event.trim();
        cleanups.push(on(ev, () => fire(t)));
        cleanups.push(localOn(ev, () => fire(t)));
      }
      if (t.ms && t.ms > 0) {
        const to = setTimeout(() => fire(t), t.ms);
        cleanups.push(() => clearTimeout(to));
        soonest = Math.min(soonest, t.ms);
      }
    }
    // Live countdown to the soonest timed transition.
    if (soonest !== Infinity) {
      const deadline = performance.now() + soonest;
      const tick = () => {
        const left = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
        onState?.(name, baseHint ? `${baseHint} · ${left}s` : `${left}s`, def);
      };
      tick();
      countdown = setInterval(tick, 250);
    }
  };

  const unsubReset = resetEvent.trim() ? on(resetEvent.trim(), () => enter(initial)) : () => {};
  enter(initial);

  return {
    current: () => currentName,
    send: (event: string) => {
      const set = localListeners.get(event);
      if (!set) return;
      for (const fn of Array.from(set)) {
        try {
          fn();
        } catch {}
      }
    },
    dispose: () => {
      disposed = true;
      while (cleanups.length) cleanups.pop()!();
      if (countdown) clearInterval(countdown);
      localListeners.clear();
      unsubReset();
    },
  };
}
