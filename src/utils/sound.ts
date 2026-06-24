// src/utils/sound.ts
// Полностью процедурный КОСМИЧЕСКИЙ звуковой движок на Web Audio API.
// Без аудиофайлов → совместимо с single-file сборкой (<100 МБ).
// FX-цепочка: voices → voiceBus → [dry + reverb(convolver) + delay(feedback)] → master → out
// Публичное API идентично прежней версии.

type ColorHex = string;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private pausedForAd = false;

  // FX-граф
  private master: GainNode | null = null;
  private voiceBus: GainNode | null = null;
  private dryGain: GainNode | null = null;
  private convolver: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private delay: DelayNode | null = null;
  private feedback: GainNode | null = null;
  private delayGain: GainNode | null = null;

  // Эмбиент
  private ambientStarted = false;
  private ambientNodes: AudioNode[] = [];
  private ambientGain: GainNode | null = null;

  // Лимит одновременных голосов (защита от перегруза)
  private activeVoices = 0;
  private readonly MAX_VOICES = 24;

  // ── Инициализация ──────────────────────────────────────────────
  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.buildGraph();
    }
    return this.ctx;
  }

  private buildGraph() {
    const ctx = this.ctx!;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);

    this.voiceBus = ctx.createGain();

    // Сухой сигнал
    this.dryGain = ctx.createGain();
    this.dryGain.gain.value = 0.85;
    this.voiceBus.connect(this.dryGain);
    this.dryGain.connect(this.master);

    // Реверб — процедурный impulse response (затухающий шум)
    this.convolver = ctx.createConvolver();
    this.convolver.buffer = this.makeReverbIR(2.6, 2.2);
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.35;
    this.voiceBus.connect(this.convolver);
    this.convolver.connect(this.reverbGain);
    this.reverbGain.connect(this.master);

    // Delay с обратной связью — космическое эхо
    this.delay = ctx.createDelay(1.5);
    this.delay.delayTime.value = 0.33;
    this.feedback = ctx.createGain();
    this.feedback.gain.value = 0.32;
    this.delayGain = ctx.createGain();
    this.delayGain.gain.value = 0.25;
    this.voiceBus.connect(this.delay);
    this.delay.connect(this.feedback);
    this.feedback.connect(this.delay); // петля ОС (0.32 < 1 → стабильно)
    this.delay.connect(this.delayGain);
    this.delayGain.connect(this.master);
  }

  private makeReverbIR(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const ir = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
    }
    return ir;
  }

  private playable(): boolean {
    if (this.muted || this.pausedForAd) return false;
    return this.getCtx().state === 'running';
  }

  private bus(): GainNode {
    return this.voiceBus!;
  }

  // Универсальный голос с ADSR-огибающей, глайдом и авто-очисткой
  private voice(
    type: OscillatorType,
    freq: number,
    dur: number,
    peak: number,
    opts: { detune?: number; glideTo?: number; target?: AudioNode } = {}
  ): { osc: OscillatorNode; gain: GainNode } | null {
    if (this.activeVoices >= this.MAX_VOICES) return null;
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.detune) osc.detune.setValueAtTime(opts.detune, t0);
    if (opts.glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.glideTo), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(opts.target ?? this.bus());
    this.activeVoices++;
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
    osc.onended = () => {
      this.activeVoices--;
      try { osc.disconnect(); gain.disconnect(); } catch { /* noop */ }
    };
    return { osc, gain };
  }

  // Фильтрованный шумовой всплеск (лазер / взрыв)
  private noiseBurst(dur: number, peak: number, freq: number, type: BiquadFilterType = 'bandpass') {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const frames = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = 6;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peak, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter); filter.connect(gain); gain.connect(this.bus());
    src.start(t0);
    src.stop(t0 + dur + 0.02);
    src.onended = () => { try { src.disconnect(); filter.disconnect(); gain.disconnect(); } catch { /* noop */ } };
  }

  // ── ВЫСТРЕЛ: лазерный «pew» ────────────────────────────────────
  playShoot() {
    if (!this.playable()) return;
    this.voice('sawtooth', 880, 0.16, 0.12, { glideTo: 180, detune: 6 });
    this.voice('square', 660, 0.12, 0.05, { glideTo: 140, detune: -8 });
    this.noiseBurst(0.05, 0.04, 1800, 'highpass');
  }

  // ── ЛОПАНЬЕ: кристально-стеклянный звук, высота зависит от цвета ─
  playPop(color: ColorHex) {
    if (!this.playable()) return;
    const colorFreqs: Record<string, number> = {
      '#FF3B5C': 523, '#FF9500': 587, '#FFCC00': 659, '#34C759': 740,
      '#007AFF': 831, '#AF52DE': 932, '#FF2D55': 988,
    };
    const f = colorFreqs[color] || 600;
    this.voice('sine', f, 0.22, 0.16, { glideTo: f * 0.6 });
    this.voice('triangle', f * 2.01, 0.18, 0.05, { glideTo: f * 1.2, detune: 4 });
  }

  // ── КОМБО: восходящее мерцающее арпеджио + хорус ────────────────
  playCombo(comboCount: number) {
    if (!this.playable()) return;
    const scale = [523, 659, 784, 988, 1175, 1319, 1568];
    const f = scale[Math.min(comboCount - 1, scale.length - 1)];
    const peak = Math.min(0.22, 0.12 + comboCount * 0.015);
    this.voice('triangle', f, 0.35, peak, { detune: 5 });
    this.voice('triangle', f, 0.35, peak, { detune: -5 });
    this.voice('sine', f * 2, 0.3, peak * 0.4, { detune: 3 });
  }

  // ── СПЕЦ-ПУЗЫРИ (опционально — см. подключение ниже) ────────────
  playSpecial(type: 'bomb' | 'rainbow' | 'lightning' | 'freeze') {
    if (!this.playable()) return;
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    switch (type) {
      case 'bomb':
        this.voice('sawtooth', 140, 0.5, 0.2, { glideTo: 40 });
        this.noiseBurst(0.4, 0.18, 220, 'lowpass');
        break;
      case 'freeze':
        this.voice('sine', 1568, 0.6, 0.1, { glideTo: 2093 });
        this.voice('triangle', 2093, 0.5, 0.05, { detune: 8 });
        break;
      case 'lightning': {
        const v = this.voice('square', 320, 0.3, 0.12, { glideTo: 1200 });
        v?.osc.detune.setValueCurveAtTime(new Float32Array([0, 600, -400, 300, 0]), t0, 0.28);
        this.noiseBurst(0.12, 0.06, 3000, 'bandpass');
        break;
      }
      case 'rainbow': {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = 'sawtooth'; osc.frequency.value = 440;
        filter.type = 'bandpass'; filter.Q.value = 8;
        filter.frequency.setValueAtTime(300, t0);
        filter.frequency.exponentialRampToValueAtTime(4000, t0 + 0.5);
        gain.gain.setValueAtTime(0.14, t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
        osc.connect(filter); filter.connect(gain); gain.connect(this.bus());
        osc.start(t0); osc.stop(t0 + 0.6);
        osc.onended = () => { try { osc.disconnect(); filter.disconnect(); gain.disconnect(); } catch { /* noop */ } };
        break;
      }
    }
  }

  // ── УРОВЕНЬ ПРОЙДЕН: триумфальное арпеджио ──────────────────────
  playLevelComplete() {
    if (!this.playable()) return;
    [523, 659, 784, 1047, 1319].forEach((f, i) => {
      setTimeout(() => {
        if (!this.playable()) return;
        this.voice('sine', f, 0.4, 0.16, { detune: 4 });
        this.voice('triangle', f * 1.5, 0.35, 0.06);
      }, i * 110);
    });
  }

  // ── GAME OVER: нисходящий тон с закрытием фильтра ───────────────
  playGameOver() {
    if (!this.playable()) return;
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(330, t0);
    osc.frequency.exponentialRampToValueAtTime(60, t0 + 1.1);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200, t0);
    filter.frequency.exponentialRampToValueAtTime(200, t0 + 1.1);
    gain.gain.setValueAtTime(0.18, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.2);
    osc.connect(filter); filter.connect(gain); gain.connect(this.bus());
    osc.start(t0); osc.stop(t0 + 1.25);
    osc.onended = () => { try { osc.disconnect(); filter.disconnect(); gain.disconnect(); } catch { /* noop */ } };
  }

  // ── РАЗБЛОКИРОВКА КОНТЕКСТА (по жесту пользователя) ─────────────
  unlock() {
    const ctx = this.getCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  // ── ЭМБИЕНТ: эволюционирующий космический пад ───────────────────
  startAmbient() {
    if (this.muted || this.pausedForAd || this.ambientStarted) return;
    const ctx = this.getCtx();
    this.ambientStarted = true;

    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 0.0001;
    this.ambientGain.connect(this.bus());
    this.ambientGain.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + 4); // плавный свелл

    const padGain = ctx.createGain();
    padGain.gain.value = 0.5;
    padGain.connect(this.ambientGain);

    const pad = [55, 82.5, 110, 164.8].map((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i % 2 ? 'triangle' : 'sine';
      osc.frequency.value = freq;
      osc.detune.value = (i - 1.5) * 6;
      g.gain.value = 0.5 / (i + 1);
      osc.connect(g); g.connect(padGain);
      osc.start();
      return osc;
    });

    // LFO модулирует padGain (медленные свеллы), а не master — чтобы stopAmbient гарантированно гасил звук
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 0.2;
    lfo.connect(lfoGain);
    lfoGain.connect(padGain.gain);
    lfo.start();

    this.ambientNodes = [...pad, lfo, padGain, lfoGain];
  }

  stopAmbient() {
    if (this.ambientGain && this.ctx) {
      const t = this.ctx.currentTime;
      this.ambientGain.gain.cancelScheduledValues(t);
      this.ambientGain.gain.setValueAtTime(Math.max(0.0001, this.ambientGain.gain.value), t);
      this.ambientGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    }
    const nodes = this.ambientNodes;
    this.ambientNodes = [];
    this.ambientStarted = false;
    setTimeout(() => {
      nodes.forEach((n) => {
        try { (n as OscillatorNode).stop?.(); } catch { /* already stopped */ }
        try { n.disconnect(); } catch { /* noop */ }
      });
      try { this.ambientGain?.disconnect(); } catch { /* noop */ }
      this.ambientGain = null;
    }, 900);
  }

  // ── ПАУЗА / РЕКЛАМА / MUTE (правила Яндекса 1.3 и 4.7) ──────────
  pauseForAd() {
    this.pausedForAd = true;
    if (this.ctx?.state === 'running') this.ctx.suspend().catch(() => {});
  }

  resumeAfterAd() {
    this.pausedForAd = false;
    if (this.ctx?.state === 'suspended' && !this.muted) this.ctx.resume().catch(() => {});
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted && this.ctx?.state === 'running') {
      this.ctx.suspend().catch(() => {});
    } else if (!this.muted && !this.pausedForAd && this.ctx?.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.muted;
  }

  isMuted() {
    return this.muted;
  }
}

export const sound = new SoundEngine();
