/** Tiny synthesized sound effects — no audio files needed. */
let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(m: boolean): void {
  muted = m;
}

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.15): void {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + start;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const sfx = {
  click: () => tone(660, 0, 0.08, 'triangle', 0.06),
  correct: () => {
    tone(784, 0, 0.18, 'triangle');
    tone(1175, 0.09, 0.3, 'triangle');
  },
  wrong: () => {
    tone(220, 0, 0.25, 'sawtooth', 0.07);
    tone(165, 0.1, 0.3, 'sawtooth', 0.06);
  },
  stamp: () => {
    tone(110, 0, 0.25, 'square', 0.12);
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.15 + i * 0.09, 0.35, 'triangle', 0.1));
  },
  takeoff: () => {
    const a = ac();
    if (!a) return;
    const len = a.sampleRate * 2.2;
    const buf = a.createBuffer(1, len, a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.sin((i / len) * Math.PI);
    const src = a.createBufferSource();
    src.buffer = buf;
    const filter = a.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(300, a.currentTime);
    filter.frequency.exponentialRampToValueAtTime(1800, a.currentTime + 2);
    const g = a.createGain();
    g.gain.value = 0.12;
    src.connect(filter).connect(g).connect(a.destination);
    src.start();
  },
  chime: () => [659, 880, 1319].forEach((f, i) => tone(f, i * 0.12, 0.5, 'sine', 0.08)),
};
