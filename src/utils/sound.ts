class SoundManager {
  private audioCtx: AudioContext | null = null;
  private muted = false;
  private masterVolume = 0.3;

  private getCtx(): AudioContext | null {
    if (this.muted) return null;
    if (!this.audioCtx) {
      try {
        this.audioCtx = new AudioContext();
      } catch {
        return null;
      }
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.muted && this.audioCtx) {
      this.audioCtx.suspend();
    } else if (this.audioCtx) {
      this.audioCtx.resume();
    }
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  pause(): void {
    if (this.audioCtx && this.audioCtx.state === 'running') {
      this.audioCtx.suspend();
    }
  }

  resume(): void {
    if (this.audioCtx && this.audioCtx.state === 'suspended' && !this.muted) {
      this.audioCtx.resume();
    }
  }

  private playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.3, delay = 0): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    gain.gain.setValueAtTime(volume * this.masterVolume, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration);
  }

  playShoot(): void {
    this.playTone(600, 0.08, 'square', 0.15);
    this.playTone(400, 0.06, 'sine', 0.1, 0.03);
  }

  playPop(_color?: string): void {
    this.playTone(800 + Math.random() * 400, 0.1, 'sine', 0.2);
    this.playTone(1200 + Math.random() * 300, 0.06, 'sine', 0.1, 0.04);
  }

  playBounce(): void {
    this.playTone(300, 0.04, 'square', 0.1);
  }

  playCombo(level: number): void {
    const base = 500 + level * 100;
    this.playTone(base, 0.15, 'sine', 0.25);
    this.playTone(base * 1.25, 0.12, 'sine', 0.2, 0.08);
    this.playTone(base * 1.5, 0.15, 'sine', 0.25, 0.16);
  }

  playGameOver(): void {
    this.playTone(300, 0.3, 'sawtooth', 0.2);
    this.playTone(200, 0.4, 'sawtooth', 0.15, 0.2);
    this.playTone(120, 0.5, 'sawtooth', 0.1, 0.4);
  }

  playLevelComplete(): void {
    [523, 659, 784, 1047].forEach((f, i) => {
      this.playTone(f, 0.2, 'sine', 0.2, i * 0.12);
    });
  }

  playBombSpecial(): void {
    this.playTone(100, 0.3, 'sawtooth', 0.3);
    this.playTone(80, 0.4, 'square', 0.2, 0.1);
  }

  playRainbowSpecial(): void {
    [600, 700, 800, 900, 1000].forEach((f, i) => {
      this.playTone(f, 0.1, 'sine', 0.15, i * 0.05);
    });
  }

  playLightningSpecial(): void {
    this.playTone(2000, 0.05, 'square', 0.2);
    this.playTone(1500, 0.08, 'square', 0.15, 0.05);
    this.playTone(2500, 0.05, 'square', 0.15, 0.1);
  }

  playFreezeSpecial(): void {
    this.playTone(1500, 0.2, 'sine', 0.2);
    this.playTone(1800, 0.15, 'sine', 0.15, 0.1);
    this.playTone(2000, 0.2, 'sine', 0.1, 0.2);
  }

  playClick(): void {
    this.playTone(700, 0.04, 'square', 0.12);
  }
}

export const sound = new SoundManager();
