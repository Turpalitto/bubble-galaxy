/**
 * Bubble Galaxy — Advanced Sound Engine
 * 
 * Использует Web Audio API с генерацией сложных звуков:
 * - Многослойные текстуры (осцилляторы + шум)
 * - Тембральная модуляция (LFO, filter sweeps)
 * - Раздельные каналы для музыки и SFX
 * - Плавные crossfade между состояниями
 */

type WaveType = OscillatorType;

interface NoteEvent {
  freq: number;
  time: number;    // seconds from now
  duration: number;
  gain?: number;
  type?: WaveType;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private muted = false;
  private pausedForAd = false;

  // Ambient
  private ambientStarted = false;
  private ambientNodes: OscillatorNode[] = [];
  private ambientNoise: AudioBufferSourceNode | null = null;

  // ─── AudioContext management ─────────────────────────────────

  private getCtx(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext();
      this.setupRouting();
    }
    return this.ctx;
  }

  private setupRouting() {
    if (!this.ctx) return;
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.7;
    this.masterGain.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.8;
    this.sfxGain.connect(this.masterGain);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.3;
    this.musicGain.connect(this.masterGain);
  }

  unlock() {
    const ctx = this.getCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  isMuted() { return this.muted; }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.muted) {
      this.sfxGain?.gain.setValueAtTime(0, this.getCtx().currentTime);
      this.musicGain?.gain.setValueAtTime(0, this.getCtx().currentTime);
    } else {
      this.sfxGain?.gain.setValueAtTime(0.8, this.getCtx().currentTime);
      this.musicGain?.gain.setValueAtTime(0.3, this.getCtx().currentTime);
    }
    return this.muted;
  }

  // ─── Noise generator ──────────────────────────────────────────

  private createNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private playNoiseBurst(ctx: AudioContext, duration: number, gain: number, filterFreq?: number, filterType?: BiquadFilterType) {
    const buffer = this.createNoiseBuffer(ctx, duration);
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    let node: AudioNode = source;
    
    if (filterFreq) {
      const filter = ctx.createBiquadFilter();
      filter.type = filterType || 'lowpass';
      filter.frequency.value = filterFreq;
      filter.Q.value = 1;
      source.connect(filter);
      node = filter;
    }

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(gain, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    node.connect(gainNode);
    gainNode.connect(this.sfxGain!);

    source.start(ctx.currentTime);
    source.stop(ctx.currentTime + duration);
  }

  // ─── Helper: schedule notes ───────────────────────────────────

  private scheduleNotes(notes: NoteEvent[], destination: AudioNode, baseTime?: number) {
    const ctx = this.getCtx();
    const now = baseTime ?? ctx.currentTime;
    
    notes.forEach(({ freq, time, duration, gain = 0.15, type = 'sine' }) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + time);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.001, now + time);
      env.gain.linearRampToValueAtTime(gain, now + time + 0.02);
      env.gain.exponentialRampToValueAtTime(0.001, now + time + duration);

      osc.connect(env);
      env.connect(destination);
      osc.start(now + time);
      osc.stop(now + time + duration + 0.05);
    });
  }

  // ─── SFX: Pop ─────────────────────────────────────────────────

  playPop(color: string) {
    if (this.muted || this.pausedForAd) return;
    const ctx = this.getCtx();
    
    // Color → frequency mapping (higher = brighter)
    const colorFreqs: Record<string, number> = {
      '#FF3B5C': 440,  '#FF9500': 500,  '#FFCC00': 560,
      '#34C759': 620,  '#007AFF': 700,  '#AF52DE': 780,  '#FF2D55': 820,
    };
    const freq = colorFreqs[color] || 500;

    // Layer 1: tonal pop с glissando вниз
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const gain1 = ctx.createGain();
    osc.frequency.setValueAtTime(freq * 1.5, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.3, ctx.currentTime + 0.12);
    gain1.gain.setValueAtTime(0.2, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain1);
    gain1.connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);

    // Layer 2: noise burst (опционально — для bubble shooter можно оставить)
    this.playNoiseBurst(ctx, 0.08, 0.06, 3000, 'highpass');
  }

  // ─── SFX: Shoot ───────────────────────────────────────────────

  playShoot() {
    if (this.muted || this.pausedForAd) return;
    const ctx = this.getCtx();

    // Свистящий звук с гармониками
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    const gain1 = ctx.createGain();
    osc1.frequency.setValueAtTime(400, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.06);
    gain1.gain.setValueAtTime(0.12, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc1.connect(gain1);
    gain1.connect(this.sfxGain!);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.1);

    // Гармоника (октава выше, тише)
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    const gain2 = ctx.createGain();
    osc2.frequency.setValueAtTime(800, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(2400, ctx.currentTime + 0.06);
    gain2.gain.setValueAtTime(0.05, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc2.connect(gain2);
    gain2.connect(this.sfxGain!);
    osc2.start();
    osc2.stop(ctx.currentTime + 0.08);
  }

  // ─── SFX: Wall Bounce (рикошет) ──────────────────────────────

  playBounce() {
    if (this.muted || this.pausedForAd) return;
    const ctx = this.getCtx();

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  }

  // ─── SFX: Combo ────────────────────────────────────────────────

  playCombo(comboCount: number) {
    if (this.muted || this.pausedForAd) return;
    const ctx = this.getCtx();

    // Мажорная пентатоника — приятно и не раздражает
    const pentatonic = [262, 294, 330, 392, 440, 523, 587, 659, 784, 880, 1047];
    const idx = Math.min(comboCount - 1, pentatonic.length - 1);
    const baseFreq = pentatonic[idx];

    // Основной тон
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    const gain = ctx.createGain();
    osc.frequency.value = baseFreq;
    
    // Лёгкий хорус через LFO
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 5;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 10;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start();

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
    lfo.stop(ctx.currentTime + 0.3);

    // Если комбо высокое — добавляем бас
    if (comboCount >= 5) {
      const bass = ctx.createOscillator();
      bass.type = 'sine';
      const bassGain = ctx.createGain();
      bass.frequency.value = baseFreq / 2;
      bassGain.gain.setValueAtTime(0.12, ctx.currentTime);
      bassGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      bass.connect(bassGain);
      bassGain.connect(this.sfxGain!);
      bass.start();
      bass.stop(ctx.currentTime + 0.3);
    }

    // Ускорение темпа комбо (чем выше — тем быстрее)
    const speedNote = ctx.createOscillator();
    speedNote.type = 'sine';
    const speedGain = ctx.createGain();
    speedNote.frequency.value = baseFreq * 1.5;
    speedGain.gain.setValueAtTime(0.06, ctx.currentTime);
    speedGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    speedNote.connect(speedGain);
    speedGain.connect(this.sfxGain!);
    speedNote.start();
    speedNote.stop(ctx.currentTime + 0.12);
  }

  // ─── SFX: Level Complete ─────────────────────────────────────

  playLevelComplete() {
    if (this.muted || this.pausedForAd) return;
    const ctx = this.getCtx();

    // Мажорный аккорд C-E-G-C5 с арпеджио
    const chord: NoteEvent[] = [
      { freq: 523, time: 0, duration: 0.5, gain: 0.2, type: 'sine' },        // C5
      { freq: 659, time: 0.08, duration: 0.5, gain: 0.18, type: 'sine' },     // E5
      { freq: 784, time: 0.16, duration: 0.5, gain: 0.16, type: 'sine' },     // G5
      { freq: 1047, time: 0.24, duration: 0.6, gain: 0.14, type: 'sine' },    // C6
      // Второй аккорд (G-B-D-G)
      { freq: 784, time: 0.5, duration: 0.4, gain: 0.15, type: 'triangle' },  // G5
      { freq: 988, time: 0.56, duration: 0.4, gain: 0.13, type: 'triangle' }, // B5
      { freq: 1175, time: 0.62, duration: 0.4, gain: 0.12, type: 'triangle' },// D6
      { freq: 1568, time: 0.68, duration: 0.5, gain: 0.1, type: 'triangle' }, // G6
    ];

    this.scheduleNotes(chord, this.sfxGain!);

    // Бас-педаль
    const bass = ctx.createOscillator();
    bass.type = 'sine';
    const bassGain = ctx.createGain();
    bass.frequency.value = 131; // C3
    bassGain.gain.setValueAtTime(0.15, ctx.currentTime);
    bassGain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.6);
    bassGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    bass.connect(bassGain);
    bassGain.connect(this.sfxGain!);
    bass.start();
    bass.stop(ctx.currentTime + 1.3);
  }

  // ─── SFX: Game Over ─────────────────────────────────────────

  playGameOver() {
    if (this.muted || this.pausedForAd) return;
    const ctx = this.getCtx();

    // Диссонирующий спуск (фа-ми-ре-до в миноре с тритоном)
    const fall: NoteEvent[] = [
      { freq: 370, time: 0, duration: 0.3, gain: 0.15, type: 'sawtooth' },
      { freq: 330, time: 0.2, duration: 0.3, gain: 0.14, type: 'sawtooth' },
      { freq: 294, time: 0.4, duration: 0.3, gain: 0.13, type: 'sawtooth' },
      { freq: 262, time: 0.6, duration: 0.4, gain: 0.12, type: 'sawtooth' },
      // Тритон для драматизма
      { freq: 311, time: 0.3, duration: 0.5, gain: 0.07, type: 'sine' },
    ];
    this.scheduleNotes(fall, this.sfxGain!);

    // Низкий гул
    const hum = ctx.createOscillator();
    hum.type = 'sine';
    const humGain = ctx.createGain();
    hum.frequency.value = 65; // C2
    humGain.gain.setValueAtTime(0.1, ctx.currentTime);
    humGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    hum.connect(humGain);
    humGain.connect(this.sfxGain!);
    hum.start();
    hum.stop(ctx.currentTime + 0.9);
  }

  // ─── SFX: Special Bubbles ────────────────────────────────────

  /** 💣 Bomb — мощный низкий удар */
  playBombSpecial() {
    if (this.muted || this.pausedForAd) return;
    const ctx = this.getCtx();

    // Sub-bass boom
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(80, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);

    // Хлопок (шум)
    this.playNoiseBurst(ctx, 0.15, 0.2, 200, 'lowpass');

    // Ударная волна (очень низкая частота)
    const shock = ctx.createOscillator();
    shock.type = 'sine';
    const shockGain = ctx.createGain();
    shock.frequency.setValueAtTime(40, ctx.currentTime);
    shock.frequency.exponentialRampToValueAtTime(15, ctx.currentTime + 0.3);
    shockGain.gain.setValueAtTime(0.25, ctx.currentTime);
    shockGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    shock.connect(shockGain);
    shockGain.connect(this.sfxGain!);
    shock.start();
    shock.stop(ctx.currentTime + 0.35);
  }

  /** 🌈 Rainbow — восходящее арпеджио */
  playRainbowSpecial() {
    if (this.muted || this.pausedForAd) return;
    const ctx = this.getCtx();

    const notes = [523, 659, 784, 1047, 1319, 1568];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const gain = ctx.createGain();
      osc.frequency.value = freq;

      // Хорус через LFO
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 6 + i * 0.5;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 5;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start();

      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + i * 0.08 + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.35);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + i * 0.08 + 0.4);
      lfo.stop(ctx.currentTime + i * 0.08 + 0.4);
    });
  }

  /** ⚡ Lightning — треск */
  playLightningSpecial() {
    if (this.muted || this.pausedForAd) return;
    const ctx = this.getCtx();

    // Треск шума
    this.playNoiseBurst(ctx, 0.25, 0.3, 8000, 'highpass');
    this.playNoiseBurst(ctx, 0.12, 0.15, 4000, 'bandpass');

    // Высокий звенящий тон
    const osc = ctx.createOscillator();
    osc.type = 'square';
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(3000, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  /** ❄️ Freeze — звенящий холод */
  playFreezeSpecial() {
    if (this.muted || this.pausedForAd) return;
    const ctx = this.getCtx();

    // Высокий звенящий звук (гласс-армоника)
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    const gain1 = ctx.createGain();
    osc1.frequency.setValueAtTime(1200, ctx.currentTime);
    osc1.frequency.linearRampToValueAtTime(1800, ctx.currentTime + 0.15);
    osc1.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.4);
    gain1.gain.setValueAtTime(0.12, ctx.currentTime);
    gain1.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.15);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc1.connect(gain1);
    gain1.connect(this.sfxGain!);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.5);

    // Подзвучка — призвук
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    const gain2 = ctx.createGain();
    osc2.frequency.setValueAtTime(2400, ctx.currentTime);
    osc2.frequency.linearRampToValueAtTime(3600, ctx.currentTime + 0.1);
    osc2.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.6);
    gain2.gain.setValueAtTime(0.06, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc2.connect(gain2);
    gain2.connect(this.sfxGain!);
    osc2.start();
    osc2.stop(ctx.currentTime + 0.6);

    // "Сосульки" — случайные высокие писк
    for (let i = 0; i < 3; i++) {
      const ping = ctx.createOscillator();
      ping.type = 'sine';
      const pingGain = ctx.createGain();
      const pingFreq = 2000 + Math.random() * 2000;
      ping.frequency.value = pingFreq;
      pingGain.gain.setValueAtTime(0.04, ctx.currentTime + 0.1 + i * 0.12);
      pingGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1 + i * 0.12 + 0.08);
      ping.connect(pingGain);
      pingGain.connect(this.sfxGain!);
      ping.start(ctx.currentTime + 0.1 + i * 0.12);
      ping.stop(ctx.currentTime + 0.1 + i * 0.12 + 0.1);
    }
  }

  // ─── SFX: Achievement ───────────────────────────────────────

  playAchievement() {
    if (this.muted || this.pausedForAd) return;

    // Фанфары — восходящая мажорная арпеджио
    const fanfare: NoteEvent[] = [
      { freq: 523, time: 0, duration: 0.15, gain: 0.18 },
      { freq: 659, time: 0.06, duration: 0.15, gain: 0.16 },
      { freq: 784, time: 0.12, duration: 0.2, gain: 0.14 },
      { freq: 1047, time: 0.18, duration: 0.3, gain: 0.12 },
      { freq: 1319, time: 0.25, duration: 0.35, gain: 0.1 },
    ];
    this.scheduleNotes(fanfare, this.sfxGain!);
  }

  // ─── SFX: UI ──────────────────────────────────────────────────

  playUiClick() {
    if (this.muted || this.pausedForAd) return;
    const ctx = this.getCtx();

    // Короткий щелчок
    this.playNoiseBurst(ctx, 0.03, 0.08, 5000, 'highpass');

    // Микро-тон
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const gain = ctx.createGain();
    osc.frequency.value = 800;
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  }

  playUiHover() {
    if (this.muted || this.pausedForAd) return;
    const ctx = this.getCtx();

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.02, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  }

  // ─── Ambient ──────────────────────────────────────────────────

  startAmbient() {
    if (this.muted || this.pausedForAd || this.ambientStarted) return;
    this.ambientStarted = true;
    const ctx = this.getCtx();

    // Пэд-аккорд (Cmaj7 — синтезированная струна)
    const padNotes = [262, 330, 392, 523]; // C4 E4 G4 C5
    this.ambientNodes = padNotes.map((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;

      // Лёгкая модуляция высоты для тёплого звука
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.5 + Math.random() * 0.3;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 1;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start();

      const gain = ctx.createGain();
      gain.gain.value = 0.025;
      osc.connect(gain);
      gain.connect(this.musicGain!);
      osc.start();
      return osc;
    });

    // Низкая басовая пульсация
    const bassOsc = ctx.createOscillator();
    bassOsc.type = 'sine';
    bassOsc.frequency.value = 65; // C2
    const bassGain = ctx.createGain();
    bassGain.gain.setValueAtTime(0.03, ctx.currentTime);
    bassGain.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 0.5);
    bassGain.gain.linearRampToValueAtTime(0.005, ctx.currentTime + 0.7);
    bassGain.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 1.0);
    
    // Модуляция амплитуды для пульсации (вручную через интервал)
    const startTime = ctx.currentTime;
    const pulseInterval = setInterval(() => {
      if (!this.ambientStarted) { clearInterval(pulseInterval); return; }
      const elapsed = ctx.currentTime - startTime;
      const pulse = 0.5 + 0.5 * Math.sin(elapsed * 1.5);
      bassGain.gain.setValueAtTime(0.02 * pulse + 0.005, ctx.currentTime);
    }, 50);

    bassOsc.connect(bassGain);
    bassGain.connect(this.musicGain!);
    bassOsc.start();
    this.ambientNodes.push(bassOsc);

    // Ambient noise (лёгкий ветер)
    const noiseBuf = this.createNoiseBuffer(ctx, 2);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuf;
    noiseSource.loop = true;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 200;
    noiseFilter.Q.value = 0.5;
    
    const noiseEnv = ctx.createGain();
    noiseEnv.gain.value = 0.015;

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseEnv);
    noiseEnv.connect(this.musicGain!);
    noiseSource.start();
    this.ambientNoise = noiseSource;
  }

  stopAmbient() {
    this.ambientNodes.forEach((osc) => {
      try { osc.stop(); } catch { /* already stopped */ }
    });
    this.ambientNodes = [];
    this.ambientNoise?.stop();
    this.ambientNoise = null;
    this.ambientStarted = false;
  }

  // ─── Ad state ─────────────────────────────────────────────────

  pauseForAd() {
    this.pausedForAd = true;
    this.stopAmbient();
    if (this.ctx?.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  resumeAfterAd() {
    this.pausedForAd = false;
    if (this.ctx?.state === 'suspended' && !this.muted) {
      this.ctx.resume().catch(() => {});
    }
  }

  /** 🔊 Диспетчер спец-звуков по типу */
  playSpecial(special: string) {
    switch (special) {
      case 'bomb': this.playBombSpecial(); break;
      case 'rainbow': this.playRainbowSpecial(); break;
      case 'lightning': this.playLightningSpecial(); break;
      case 'freeze': this.playFreezeSpecial(); break;
    }
  }

  shutdown() {
    this.stopAmbient();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

export const sound = new SoundEngine();