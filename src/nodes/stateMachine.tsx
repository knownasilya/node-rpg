import { Handle, NodeProps, Position, useReactFlow } from "@xyflow/react";
import { useEffect, useState } from "preact/hooks";
import { Field, NodeBody, NodeCard, NodeHeader } from "../ui";
import { useGame } from "../App";
import { emit, on, setCurrentState } from "./modifiers/shared";

// General finite state machine. Define named `states` and `transitions`
// (from → to, fired by an event, a key, and/or a timer). On entering a state
// it publishes the current state (shown as a HUD pill by the Game node) and
// optionally emits an event; a transition can also emit an event as it fires.
// `from: "*"` matches any state (a global transition). Use it for anything
// turn/round/phase/menu-based — it isn't tied to any one game.
//
// data shape:
//   initial: string
//   resetEvent?: string                       // re-enter `initial` on this event
//   states?: { name, hint?, enterEvent? }[]   // per-state HUD hint + on-enter event
//   transitions: { from, to, event?, key?, ms?, emit? }[]

type StateDef = { name: string; hint?: string; enterEvent?: string };
type Transition = {
  from: string;
  to: string;
  event?: string;
  key?: string;
  ms?: number;
  emit?: string;
};

export default function StateMachineNode({ id, data }: NodeProps) {
  const reactFlow = useReactFlow();
  const game = useGame();
  const states = (data.states as StateDef[] | undefined) ?? [];
  const transitions = (data.transitions as Transition[] | undefined) ?? [];
  const initial = (data.initial as string | undefined) ?? states[0]?.name ?? "";
  const resetEvent = (data.resetEvent as string | undefined) ?? "";
  const key = JSON.stringify([initial, states, transitions, resetEvent]);
  const [current, setCurrent] = useState(initial);

  useEffect(() => {
    if (!initial) return;
    let disposed = false;
    const cleanups: Array<() => void> = [];
    let countdown: ReturnType<typeof setInterval> | null = null;
    const stateOf = (name: string) => states.find((s) => s.name === name);

    const enter = (name: string) => {
      if (disposed) return;
      setCurrent(name);
      const def = stateOf(name);
      const baseHint = def?.hint ?? "";
      setCurrentState(name, baseHint);
      if (def?.enterEvent?.trim()) emit(def.enterEvent.trim(), { state: name });
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
        if (t.emit?.trim()) emit(t.emit.trim(), { from: name, to: t.to });
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
          cleanups.push(on(t.event.trim(), () => fire(t)));
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
          setCurrentState(name, baseHint ? `${baseHint} · ${left}s` : `${left}s`);
        };
        tick();
        countdown = setInterval(tick, 250);
      }
    };

    const unsubReset = resetEvent.trim() ? on(resetEvent.trim(), () => enter(initial)) : () => {};
    enter(initial);
    return () => {
      disposed = true;
      while (cleanups.length) cleanups.pop()!();
      if (countdown) clearInterval(countdown);
      unsubReset();
    };
    // game.resetTick: re-enter the initial state when the game is reset, so
    // the ↻ reset / play buttons always return to the starting state.
  }, [key, game.resetTick]);

  // --- Editor helpers ----------------------------------------------------
  const setStates = (next: StateDef[]) => reactFlow.updateNodeData(id, { states: next });
  const setTransitions = (next: Transition[]) => reactFlow.updateNodeData(id, { transitions: next });
  const updState = (i: number, p: Partial<StateDef>) =>
    setStates(states.map((s, idx) => (idx === i ? { ...s, ...p } : s)));
  const updTrans = (i: number, p: Partial<Transition>) =>
    setTransitions(transitions.map((t, idx) => (idx === i ? { ...t, ...p } : t)));
  const inp = { fontSize: 11, padding: "2px 4px" } as const;

  return (
    <NodeCard accent="game" style={{ minWidth: 300 }}>
      <NodeHeader
        title={(data.label as string) ?? "State Machine"}
        subtitle="state machine"
        accent="game"
        onTitleChange={(v) => reactFlow.updateNodeData(id, { label: v })}
      />
      <Handle type="source" position={Position.Right} />
      <NodeBody>
        <Field label="initial">
          <input
            className="nrpg-input"
            style={{ width: 120, textAlign: "left" }}
            value={initial}
            onChange={(e) => reactFlow.updateNodeData(id, { initial: e.currentTarget.value })}
          />
        </Field>
        <Field label="reset on">
          <input
            className="nrpg-input"
            style={{ width: 120, textAlign: "left" }}
            value={resetEvent}
            placeholder="(optional event)"
            onChange={(e) => reactFlow.updateNodeData(id, { resetEvent: e.currentTarget.value })}
          />
        </Field>
        <div style={{ fontSize: 11, color: "var(--text-subtle)", marginTop: 2 }}>
          current: <span style={{ color: "var(--accent-game)", fontWeight: 700 }}>{current || "—"}</span>
        </div>

        <div style={{ fontSize: 10, color: "var(--text-subtle)", marginTop: 4 }}>states (name · hint · on-enter event)</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {states.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 3, alignItems: "center" }}>
              <input className="nrpg-input" style={{ ...inp, width: 70, fontWeight: s.name === current ? 700 : 400 }}
                value={s.name} onChange={(e) => updState(i, { name: e.currentTarget.value })} />
              <input className="nrpg-input" style={{ ...inp, width: 80 }} placeholder="hint"
                value={s.hint ?? ""} onChange={(e) => updState(i, { hint: e.currentTarget.value })} />
              <input className="nrpg-input" style={{ ...inp, width: 90 }} placeholder="enter evt"
                value={s.enterEvent ?? ""} onChange={(e) => updState(i, { enterEvent: e.currentTarget.value })} />
              <button className="nrpg-btn icon" title="remove"
                onClick={() => setStates(states.filter((_, idx) => idx !== i))}>✕</button>
            </div>
          ))}
        </div>
        <button className="nrpg-btn" style={{ marginTop: 3 }}
          onClick={() => setStates([...states, { name: `state${states.length}` }])}>+ state</button>

        <div style={{ fontSize: 10, color: "var(--text-subtle)", marginTop: 6 }}>transitions (from→to · key/event/ms)</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {transitions.map((t, i) => (
            <div key={i} style={{ display: "flex", gap: 3, alignItems: "center",
              opacity: t.from === current || t.from === "*" ? 1 : 0.6 }}>
              <input className="nrpg-input" style={{ ...inp, width: 52 }} placeholder="from"
                value={t.from} onChange={(e) => updTrans(i, { from: e.currentTarget.value })} />
              <span style={{ fontSize: 11 }}>→</span>
              <input className="nrpg-input" style={{ ...inp, width: 52 }} placeholder="to"
                value={t.to} onChange={(e) => updTrans(i, { to: e.currentTarget.value })} />
              <input className="nrpg-input" style={{ ...inp, width: 46 }} placeholder="key"
                value={t.key ?? ""} onChange={(e) => updTrans(i, { key: e.currentTarget.value })} />
              <input className="nrpg-input" style={{ ...inp, width: 70 }} placeholder="event"
                value={t.event ?? ""} onChange={(e) => updTrans(i, { event: e.currentTarget.value })} />
              <input type="number" className="nrpg-input" style={{ ...inp, width: 46 }} placeholder="ms"
                value={t.ms ?? 0} onChange={(e) => updTrans(i, { ms: +e.currentTarget.value || undefined })} />
              <button className="nrpg-btn icon" title="remove"
                onClick={() => setTransitions(transitions.filter((_, idx) => idx !== i))}>✕</button>
            </div>
          ))}
        </div>
        <button className="nrpg-btn" style={{ marginTop: 3 }}
          onClick={() => setTransitions([...transitions, { from: current || initial, to: "" }])}>+ transition</button>
      </NodeBody>
    </NodeCard>
  );
}
