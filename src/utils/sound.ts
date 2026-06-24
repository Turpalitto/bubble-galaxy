class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private pausedForAd = false;

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  playPop(color: string) {
    if (this.muted || this.pausedForAd) return;
    const ctx = this.getCtx();
    const colorFreqs: Record<string, number> = {
      '#FF3B5C': 440, '#FF9500': 500, '#FFCC00': 560,
      '#34C759': 620, '#007AFF': 700, '#AF52DE': 780, '#FF2D55': 820,
    };
    const freq = colorFreqs[color] || 500;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.3, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  playShoot() {
    if (this.muted || this.pausedForAd) return;
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  playCombo(comboCount: number) {
    if (this.muted || this.pausedForAd) return;
    const ctx = this.getCtx();
    const notes = [262, 330, 392, 523, 659, 784, 1047];
    const freq = notes[Math.min(comboCount - 1, notes.length - 1)];
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  }

  playLevelComplete() {
    if (this.muted || this.pausedForAd) return;
    const ctx = this.getCtx();
    const melody = [523, 659, 784, 1047];
    melody.forEach((freq, i) => {
      setTimeout(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }, i * 120);
    });
  }

  playGameOver() {
    if (this.muted || this.pausedForAd) return;
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.8);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.start();
    osc.stop(ctx.currentTime + 0.8);
  }

  private ambientStarted = false;
  private ambientNodes: OscillatorNode[] = [];

  unlock() {
    const ctx = this.getCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  startAmbient() {
    if (this.muted || this.pausedForAd || this.ambientStarted) return;
    this.ambientStarted = true;
    const ctx = this.getCtx();
    this.ambientNodes = [55, 110, 165].map((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = 0.02;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      return osc;
    });
  }

  stopAmbient() {
    this.ambientNodes.forEach((osc) => {
      try { osc.stop(); } catch { /* already stopped */ }
    });
    this.ambientNodes = [];
    this.ambientStarted = false;
  }

  pauseForAd() {
    this.pausedForAd = true;
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
