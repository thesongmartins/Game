// Tiny synthesised sound effects with WebAudio: no audio files to ship.
let ctx;

function ensure() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq, { type = 'sine', duration = 0.12, gain = 0.15, slide = 0, delay = 0 } = {}) {
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + duration);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export const sfx = {
  /** Call on the first user gesture so the browser lets audio play. */
  unlock: () => ensure(),
  gem(streak = 1) {
    const base = 660 + Math.min(streak, 8) * 60;
    tone(base, { duration: 0.09, gain: 0.12 });
    tone(base * 1.5, { duration: 0.14, gain: 0.1, delay: 0.07 });
  },
  jump: () => tone(300, { type: 'triangle', duration: 0.18, gain: 0.1, slide: 320 }),
  hit() {
    tone(160, { type: 'sawtooth', duration: 0.25, gain: 0.18, slide: -110 });
    tone(90, { type: 'square', duration: 0.3, gain: 0.08, slide: -40 });
  },
  heartbeat: () => tone(120, { type: 'triangle', duration: 0.2, gain: 0.08, slide: -60 }),
  over() {
    [440, 370, 311, 262].forEach((f, i) => tone(f, { type: 'triangle', duration: 0.28, gain: 0.12, delay: i * 0.22 }));
  },
  start() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, { duration: 0.15, gain: 0.1, delay: i * 0.09 }));
  },
};
