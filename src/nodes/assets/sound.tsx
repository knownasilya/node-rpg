import {
  Handle,
  NodeProps,
  Position,
  useReactFlow,
} from "@xyflow/react";
import { Sound } from "excalibur";
import { useEffect, useRef, useState } from "preact/hooks";
import { useGame } from "../../App";
import { Button, Field, NodeBody, NodeCard, NodeHeader, Toggle } from "../../ui";
import {
  registerSound,
  setSoundBaseVolume,
  unregisterSound,
} from "../modifiers/shared";

// Sound asset node. Builds an ex.Sound by src, registers by node id, and
// gives the user a play/stop button + volume slider for quick auditioning
// in the editor. Same Sound instance is fed to the Game node's ex.Loader.

export default function SoundNode({ id, data }: NodeProps) {
  const reactFlow = useReactFlow();
  const game = useGame();
  const [src, setSrc] = useState<string>(
    (data.src as string | undefined) ?? "",
  );
  const [volume, setVolume] = useState<number>(
    (data.volume as number | undefined) ?? 1,
  );
  const [loop, setLoop] = useState<boolean>(
    (data.loop as boolean | undefined) ?? false,
  );
  const [playing, setPlaying] = useState(false);
  const soundRef = useRef<Sound | undefined>(undefined);

  useEffect(() => {
    const trimmed = src.trim();
    if (!trimmed) {
      unregisterSound(id);
      soundRef.current = undefined;
      return;
    }
    const snd = new Sound(trimmed);
    snd.loop = loop;
    snd.volume = volume;
    registerSound(id, snd);
    setSoundBaseVolume(id, volume);
    soundRef.current = snd;
    // Eagerly load + decode the audio buffer so the first in-game play()
    // doesn't have to wait for the network fetch. Previously the only
    // path that called load() was the node's play button — so triggering
    // a sound from a gameplay event without first tapping that button
    // would silently fire on an undecoded buffer.
    snd.load().catch((err) => {
      console.warn(`[sound:${id}] load failed`, err);
    });
    return () => {
      try {
        snd.stop();
      } catch {}
      unregisterSound(id);
      soundRef.current = undefined;
    };
  }, [id, src]);

  useEffect(() => {
    if (soundRef.current) {
      soundRef.current.loop = loop;
      soundRef.current.volume = volume;
    }
    // Track the authored base volume in the side-registry — consumers read
    // from there instead of snd.volume (which `snd.play(v)` overwrites).
    setSoundBaseVolume(id, volume);
  }, [id, loop, volume]);

  // Wire the Sound to the engine so its WebAudio instances share the
  // engine's audio context. Without this the first in-game play (triggered
  // by a gameplay event) creates a separate, locked context and the sound
  // is silent until the user manually plays it from the node UI. Re-fires
  // when game.engine changes (template switch, etc.).
  useEffect(() => {
    if (!soundRef.current || !game.engine) return;
    try {
      soundRef.current.wireEngine(game.engine);
    } catch (err) {
      console.warn(`[sound:${id}] wireEngine failed`, err);
    }
  }, [game.engine, src, id]);

  const handlePlay = async () => {
    const snd = soundRef.current;
    if (!snd) return;
    if (playing) {
      try {
        snd.stop();
      } catch {}
      setPlaying(false);
      return;
    }
    try {
      if (!snd.isLoaded()) await snd.load();
      snd.play(volume);
      setPlaying(true);
      // Auto-flip back to "play" once a non-loop sound finishes.
      if (!loop) {
        const duration = (snd as any).duration as number | undefined;
        if (typeof duration === "number" && duration > 0) {
          setTimeout(() => setPlaying(false), duration * 1000);
        }
      }
    } catch (err) {
      console.warn(`[sound:${id}] play failed`, err);
    }
  };

  return (
    <NodeCard accent="entity" style={{ minWidth: 240 }}>
      <NodeHeader
        title={(data.label as string) ?? "Sound"}
        subtitle="sound"
        accent="entity"
        onTitleChange={(v) => reactFlow.updateNodeData(id, { label: v })}
      />
      <Handle type="source" position={Position.Right} />
      <NodeBody>
        <Field label="src">
          <input
            type="text"
            className="nrpg-input"
            style={{ width: 160, textAlign: "left" }}
            value={src}
            placeholder="/sounds/jump.wav"
            onChange={(e) => {
              setSrc(e.currentTarget.value);
              reactFlow.updateNodeData(id, { src: e.currentTarget.value });
            }}
          />
        </Field>
        <Field label="volume">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => {
              const v = +e.currentTarget.value;
              setVolume(v);
              reactFlow.updateNodeData(id, { volume: v });
            }}
          />
        </Field>
        <Toggle
          label="loop"
          checked={loop}
          onChange={(v) => {
            setLoop(v);
            reactFlow.updateNodeData(id, { loop: v });
          }}
        />
        <Button onClick={handlePlay} variant="primary">
          {playing ? "■ stop" : "▶ play"}
        </Button>
      </NodeBody>
    </NodeCard>
  );
}
