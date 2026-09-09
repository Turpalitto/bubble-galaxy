/** Tiny Web Audio synth — no binary assets, everything generated. */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  soundOn = true;
  musicOn = true;
  fever = false;

  private ensure() {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.6;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  unlock() {
    this.ensure();
    if (this.musicOn) this.startMusic();
  }

  private tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.3, slide = 0, out?: AudioNode) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(out ?? this.master);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  }

  private noise(dur: number, vol = 0.2) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = vol;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 900;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start();
  }

  shoot() {
    if (!this.soundOn) return;
    this.tone(520, 0.12, "triangle", 0.18, -220);
  }
  bounce() {
    if (!this.soundOn) return;
    this.tone(300, 0.06, "square", 0.05, 80);
  }
  stick() {
    if (!this.soundOn) return;
    this.tone(180, 0.08, "sine", 0.12, -60);
  }
  pop(combo: number, count: number) {
    if (!this.soundOn) return;
    const base = 420 + Math.min(combo, 10) * 55;
    const n = Math.min(count, 6);
    for (let i = 0; i < n; i++) {
      setTimeout(() => this.tone(base * Math.pow(1.06, i), 0.16, "sine", 0.22, 120), i * 35);
    }
    if (combo >= 3) setTimeout(() => this.tone(base * 2, 0.25, "triangle", 0.12, 200), n * 35);
  }
  fall(count: number) {
    if (!this.soundOn) return;
    for (let i = 0; i < Math.min(count, 5); i++) setTimeout(() => this.tone(700 - i * 60, 0.12, "sine", 0.1, -300), i * 45);
  }
  explode() {
    if (!this.soundOn) return;
    this.noise(0.45, 0.35);
    this.tone(90, 0.4, "sawtooth", 0.25, -60);
  }
  zap() {
    if (!this.soundOn) return;
    this.tone(1400, 0.25, "sawtooth", 0.12, -1200);
    this.noise(0.15, 0.15);
  }
  feverStart() {
    if (!this.soundOn) return;
    [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, "triangle", 0.2), i * 70));
  }
  wave() {
    if (!this.soundOn) return;
    this.tone(160, 0.35, "sawtooth", 0.12, -40);
  }
  win() {
    if (!this.soundOn) return;
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => setTimeout(() => this.tone(f, 0.35, "triangle", 0.22), i * 110));
  }
  lose() {
    if (!this.soundOn) return;
    [440, 370, 311, 220].forEach((f, i) => setTimeout(() => this.tone(f, 0.45, "sawtooth", 0.14, -30), i * 180));
  }
  click() {
    if (!this.soundOn) return;
    this.tone(900, 0.05, "square", 0.05, -200);
  }

  setSound(on: boolean) {
    this.soundOn = on;
  }
  setMusic(on: boolean) {
    this.musicOn = on;
    if (on) this.startMusic();
    else this.stopMusic();
  }

  private startMusic() {
    const ctx = this.ensure();
    if (!ctx || this.musicTimer || !this.musicGain) return;
    const scale = [261.63, 311.13, 349.23, 392.0, 466.16, 523.25, 622.25, 698.46];
    const bass = [130.81, 116.54, 103.83, 116.54];
    this.musicTimer = setInterval(() => {
      if (document.hidden) return;
      const s = this.step++;
      const bar = Math.floor(s / 8) % 4;
      const beat = s % 8;
      if (beat === 0) this.tone(bass[bar], 1.6, "triangle", 0.5, 0, this.musicGain!);
      const idx = (s * 3 + bar) % scale.length;
      const f = scale[idx] * (this.fever ? 2 : 1);
      this.tone(f, 0.5, "sine", 0.35, 0, this.musicGain!);
      if (beat % 2 === 1) this.tone(f * 1.5, 0.35, "sine", 0.12, 0, this.musicGain!);
    }, this.fever ? 140 : 220);
  }
  private stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }
  setFever(on: boolean) {
    if (this.fever === on) return;
    this.fever = on;
    if (this.musicTimer) {
      this.stopMusic();
      if (this.musicOn) this.startMusic();
    }
  }
}

export const audio = new AudioEngine();

export function haptic(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* ignore */
    }
  }
}
