// صداهای کوتاهِ سنتزی با WebAudio — بدون فایلِ صوتی.
let ctx: AudioContext | null = null;

function ac() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.08) {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, a.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, a.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + start);
  o.stop(a.currentTime + start + dur + 0.05);
}

export const sound = {
  click: () => tone(880, 0, 0.05, 'square', 0.03),
  ok: () => { tone(660, 0, 0.12); tone(990, 0.1, 0.2); },
  error: () => { tone(200, 0, 0.18, 'sawtooth', 0.05); tone(150, 0.12, 0.2, 'sawtooth', 0.05); },
  door: () => { tone(110, 0, 0.35, 'triangle', 0.1); tone(220, 0.05, 0.25, 'triangle', 0.05); },
  key: () => { tone(1320, 0, 0.08); tone(1760, 0.08, 0.15); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.18, 0.5, 'triangle', 0.09)),
  lose: () => [392, 311, 262, 196].forEach((f, i) => tone(f, i * 0.25, 0.6, 'sawtooth', 0.05)),
};
