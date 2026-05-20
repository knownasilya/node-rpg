import { NodeProps, useReactFlow } from "@xyflow/react";
import { Component } from "excalibur";
import { useEffect } from "preact/hooks";
import { ModShell } from "../../ui";
import { useGame } from "../../App";
import { useParentActors } from "./shared";
import {
  runChart,
  type ChartHandle,
  type StateDef,
  type Transition,
} from "./chartRuntime";

// StateChartModifier: gives the parent Actor (and EACH of its instances) its
// own running state chart. Same model as the global State Machine node, but
// per-instance — the current state lives on a StateChartComponent attached to
// the Excalibur actor, so sibling modifiers (Speech Bubble, Dialog, Patrol,
// Attack) can read it and send events to *this* instance.
//
// States gain an optional `say` (shown by Speech Bubble / Dialog); transitions
// gain an optional `label` (a labeled transition becomes a Dialog option that
// sends its `event` to this instance's chart).

// Excalibur component holding one instance's live chart state. Zero-arg ctor
// is required by Excalibur's component system; `_send` is wired by the
// modifier after the runner is created.
export class StateChartComponent extends Component {
  current = "";
  hint = "";
  say?: string;
  // Labeled outgoing transitions of the current state — the Dialog panel turns
  // these into option buttons.
  options: { label: string; event: string }[] = [];
  _send: (event: string) => void = () => {};
  send(event: string): void {
    this._send(event);
  }
}

export default function StateChartModifier({ id, data, parentId }: NodeProps) {
  const reactFlow = useReactFlow();
  const game = useGame();
  const actors = useParentActors(parentId);
  const actorsKey = actors.map((a) => a.id).join(",");

  const states = (data.states as StateDef[] | undefined) ?? [];
  const transitions = (data.transitions as Transition[] | undefined) ?? [];
  const initial = (data.initial as string | undefined) ?? states[0]?.name ?? "";
  const resetEvent = (data.resetEvent as string | undefined) ?? "";
  const specKey = JSON.stringify([initial, states, transitions, resetEvent]);

  useEffect(() => {
    if (actors.length === 0 || !initial) return;
    const handles: ChartHandle[] = [];
    const attached = actors.slice();
    for (const a of attached) {
      let comp = a.get(StateChartComponent);
      if (!comp) {
        comp = new StateChartComponent();
        a.addComponent(comp);
      }
      const c = comp;
      const handle = runChart(
        { initial, resetEvent, states, transitions },
        {
          source: id,
          onState: (name, hint, def) => {
            c.current = name;
            c.hint = hint;
            c.say = def?.say;
            c.options = transitions
              .filter(
                (t) =>
                  (t.from === name || t.from === "*") &&
                  !!t.label?.trim() &&
                  !!t.event?.trim(),
              )
              .map((t) => ({ label: t.label!.trim(), event: t.event!.trim() }));
          },
        },
      );
      c._send = handle.send;
      handles.push(handle);
    }
    return () => {
      for (const h of handles) h.dispose();
      for (const a of attached) {
        if (a.get(StateChartComponent)) {
          try {
            a.removeComponent(StateChartComponent);
          } catch {}
        }
      }
    };
  }, [actorsKey, specKey, game.resetTick]);

  // --- Editor helpers (mirrors the State Machine node, + say / label) -----
  const setStates = (next: StateDef[]) => reactFlow.updateNodeData(id, { states: next });
  const setTransitions = (next: Transition[]) =>
    reactFlow.updateNodeData(id, { transitions: next });
  const updState = (i: number, p: Partial<StateDef>) =>
    setStates(states.map((s, idx) => (idx === i ? { ...s, ...p } : s)));
  const updTrans = (i: number, p: Partial<Transition>) =>
    setTransitions(transitions.map((t, idx) => (idx === i ? { ...t, ...p } : t)));
  const inp = { fontSize: 11, padding: "2px 4px" } as const;

  return (
    <ModShell
      id={id}
      data={data}
      accent="var(--accent-game)"
      title="State Chart"
      summary={`${initial || "—"} · ${states.length} states`}
    >
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
        initial
        <input
          className="nrpg-input"
          style={{ width: 110, textAlign: "left" }}
          value={initial}
          onChange={(e) => reactFlow.updateNodeData(id, { initial: e.currentTarget.value })}
        />
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, marginTop: 3 }}>
        reset on
        <input
          className="nrpg-input"
          style={{ width: 110, textAlign: "left" }}
          value={resetEvent}
          placeholder="(optional event)"
          onChange={(e) => reactFlow.updateNodeData(id, { resetEvent: e.currentTarget.value })}
        />
      </label>

      <div style={{ fontSize: 10, color: "var(--text-subtle)", marginTop: 6 }}>
        states (name · hint · say · on-enter event)
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {states.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 3, alignItems: "center" }}>
            <input className="nrpg-input" style={{ ...inp, width: 64 }} placeholder="name"
              value={s.name} onChange={(e) => updState(i, { name: e.currentTarget.value })} />
            <input className="nrpg-input" style={{ ...inp, width: 64 }} placeholder="hint"
              value={s.hint ?? ""} onChange={(e) => updState(i, { hint: e.currentTarget.value })} />
            <input className="nrpg-input" style={{ ...inp, width: 90 }} placeholder="say"
              value={s.say ?? ""} onChange={(e) => updState(i, { say: e.currentTarget.value })} />
            <input className="nrpg-input" style={{ ...inp, width: 80 }} placeholder="enter evt"
              value={s.enterEvent ?? ""} onChange={(e) => updState(i, { enterEvent: e.currentTarget.value })} />
            <button className="nrpg-btn icon" title="remove"
              onClick={() => setStates(states.filter((_, idx) => idx !== i))}>✕</button>
          </div>
        ))}
      </div>
      <button className="nrpg-btn" style={{ marginTop: 3 }}
        onClick={() => setStates([...states, { name: `state${states.length}` }])}>+ state</button>

      <div style={{ fontSize: 10, color: "var(--text-subtle)", marginTop: 6 }}>
        transitions (from→to · key/event/ms · label = dialog option)
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {transitions.map((t, i) => (
          <div key={i} style={{ display: "flex", gap: 3, alignItems: "center" }}>
            <input className="nrpg-input" style={{ ...inp, width: 48 }} placeholder="from"
              value={t.from} onChange={(e) => updTrans(i, { from: e.currentTarget.value })} />
            <span style={{ fontSize: 11 }}>→</span>
            <input className="nrpg-input" style={{ ...inp, width: 48 }} placeholder="to"
              value={t.to} onChange={(e) => updTrans(i, { to: e.currentTarget.value })} />
            <input className="nrpg-input" style={{ ...inp, width: 40 }} placeholder="key"
              value={t.key ?? ""} onChange={(e) => updTrans(i, { key: e.currentTarget.value })} />
            <input className="nrpg-input" style={{ ...inp, width: 64 }} placeholder="event"
              value={t.event ?? ""} onChange={(e) => updTrans(i, { event: e.currentTarget.value })} />
            <input type="number" className="nrpg-input" style={{ ...inp, width: 42 }} placeholder="ms"
              value={t.ms ?? 0} onChange={(e) => updTrans(i, { ms: +e.currentTarget.value || undefined })} />
            <input className="nrpg-input" style={{ ...inp, width: 72 }} placeholder="label"
              value={t.label ?? ""} onChange={(e) => updTrans(i, { label: e.currentTarget.value })} />
            <button className="nrpg-btn icon" title="remove"
              onClick={() => setTransitions(transitions.filter((_, idx) => idx !== i))}>✕</button>
          </div>
        ))}
      </div>
      <button className="nrpg-btn" style={{ marginTop: 3 }}
        onClick={() => setTransitions([...transitions, { from: initial, to: "" }])}>+ transition</button>
    </ModShell>
  );
}
