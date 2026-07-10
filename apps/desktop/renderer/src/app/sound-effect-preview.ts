/* =========================================================
Nombre completo: sound-effect-preview.ts
Ruta o ubicación: /apps/desktop/renderer/src/app/sound-effect-preview.ts

Función o funciones:
- Previsualizar presets de efectos de sonido con Web Audio.
- Aplicar ganancia, paneo y duración sin acceder a archivos.
- Liberar todos los nodos y el contexto después de reproducir.
========================================================= */

import type { SoundEffectPresetId } from "../../../shared/domain";

function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

function createNoiseBuffer(
  context: AudioContext,
  durationSeconds: number,
): AudioBuffer {
  const frameCount = Math.max(1, Math.round(context.sampleRate * durationSeconds));
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < channel.length; index += 1) {
    channel[index] = Math.random() * 2 - 1;
  }
  return buffer;
}

async function previewSoundEffect(
  presetId: SoundEffectPresetId,
  gainDb: number,
  pan: number,
  requestedDurationSeconds: number,
): Promise<void> {
  const context = new AudioContext();
  const start = context.currentTime + 0.02;
  const duration = Math.min(3, Math.max(0.05, requestedDurationSeconds));
  const master = context.createGain();
  const panner = context.createStereoPanner();
  master.gain.setValueAtTime(dbToGain(Math.min(6, gainDb)), start);
  panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), start);
  master.connect(panner).connect(context.destination);

  const finishAt = start + duration;
  const envelope = (attack = 0.005, release = 0.12): GainNode => {
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(1, start + Math.min(attack, duration / 3));
    gain.gain.setValueAtTime(1, Math.max(start + attack, finishAt - release));
    gain.gain.exponentialRampToValueAtTime(0.0001, finishAt);
    gain.connect(master);
    return gain;
  };

  if (presetId === "whoosh" || presetId === "camera" || presetId === "applause") {
    const source = context.createBufferSource();
    source.buffer = createNoiseBuffer(context, duration);
    const filter = context.createBiquadFilter();
    filter.type = presetId === "whoosh" ? "bandpass" : "highpass";
    filter.frequency.setValueAtTime(presetId === "whoosh" ? 250 : 1_200, start);
    filter.frequency.exponentialRampToValueAtTime(
      presetId === "whoosh" ? 5_000 : 3_500,
      finishAt,
    );
    source.connect(filter).connect(envelope(0.01, presetId === "applause" ? 0.45 : 0.1));
    source.start(start);
    source.stop(finishAt);
  } else {
    const oscillator = context.createOscillator();
    oscillator.type = presetId === "click" ? "square" : "sine";
    const frequencies: Readonly<Record<Exclude<SoundEffectPresetId, "whoosh" | "camera" | "applause">, readonly [number, number]>> = {
      click: [1_600, 700],
      pop: [720, 130],
      impact: [120, 42],
      notification: [660, 990],
    };
    const [from, to] = frequencies[presetId];
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), finishAt);
    oscillator.connect(envelope(0.003, presetId === "impact" ? 0.4 : 0.08));
    oscillator.start(start);
    oscillator.stop(finishAt);
  }

  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, Math.ceil((duration + 0.12) * 1_000));
  });
  await context.close();
}

export { previewSoundEffect };
