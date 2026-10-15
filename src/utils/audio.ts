class AudioManager {
  private audioContext: AudioContext | null = null;
  private audioBuffers: Map<string, AudioBuffer> = new Map();
  private currentSource: AudioBufferSourceNode | null = null;
  private currentHtmlAudio: HTMLAudioElement | null = null;
  private volume: number = 0.9;
  private safetyTimer: NodeJS.Timeout | null = null;
  private isUnlocked: boolean = false;

  constructor() {
    // Attempt unlock on first interaction
    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.unlockAudioContext();
        window.removeEventListener('click', unlock);
        window.removeEventListener('touchstart', unlock);
        window.removeEventListener('keydown', unlock);
      };
      window.addEventListener('click', unlock, { once: true });
      window.addEventListener('touchstart', unlock, { once: true });
      window.addEventListener('keydown', unlock, { once: true });
    }
  }

  public unlockAudioContext(): AudioContext | null {
    try {
      const ctx = this.getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      this.isUnlocked = true;
      return ctx;
    } catch {
      return null;
    }
  }

  private getAudioContext(): AudioContext {
    if (!this.audioContext && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
      }
    }
    return this.audioContext as AudioContext;
  }

  public async preloadAll(soundFiles: string[]) {
    soundFiles.forEach((file) => {
      this.loadBuffer(file).catch(() => {});
    });
  }

  private async loadBuffer(soundFile: string): Promise<AudioBuffer | null> {
    if (this.audioBuffers.has(soundFile)) {
      return this.audioBuffers.get(soundFile)!;
    }

    try {
      const response = await fetch(soundFile);
      if (!response.ok) return null;
      const arrayBuffer = await response.arrayBuffer();
      const ctx = this.getAudioContext();
      if (!ctx) return null;

      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      this.audioBuffers.set(soundFile, audioBuffer);
      return audioBuffer;
    } catch (err) {
      console.warn('Could not decode audio buffer, will fallback to HTMLAudio:', err);
      return null;
    }
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.currentHtmlAudio) {
      this.currentHtmlAudio.volume = this.volume;
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public stopCurrent() {
    if (this.safetyTimer) {
      clearTimeout(this.safetyTimer);
      this.safetyTimer = null;
    }

    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch {
        // Source already stopped
      }
      this.currentSource = null;
    }

    if (this.currentHtmlAudio) {
      try {
        this.currentHtmlAudio.pause();
        this.currentHtmlAudio.currentTime = 0;
      } catch {
        // Ignore
      }
      this.currentHtmlAudio = null;
    }
  }

  public playAnimalSound(
    soundFile: string,
    onEnded?: () => void,
    onStart?: () => void
  ) {
    this.stopCurrent();
    this.unlockAudioContext();

    // Trigger gentle haptic vibration on mobile
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(40);
      } catch {
        // Ignore
      }
    }

    let hasEndedFired = false;
    const fireEnded = () => {
      if (hasEndedFired) return;
      hasEndedFired = true;
      if (this.safetyTimer) {
        clearTimeout(this.safetyTimer);
        this.safetyTimer = null;
      }
      if (onEnded) onEnded();
    };

    // 1. Try Web Audio buffer first (instant, zero delay, works in all tabs)
    const ctx = this.getAudioContext();
    const cachedBuffer = this.audioBuffers.get(soundFile);

    if (ctx && cachedBuffer) {
      try {
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }

        const source = ctx.createBufferSource();
        source.buffer = cachedBuffer;

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(this.volume, ctx.currentTime);

        source.connect(gainNode);
        gainNode.connect(ctx.destination);

        this.currentSource = source;

        source.onended = () => {
          if (this.currentSource === source) {
            this.currentSource = null;
          }
          fireEnded();
        };

        source.start(0);
        if (onStart) onStart();

        // Safety fallback timer matching buffer duration + 100ms
        const safeDurationMs = Math.min((cachedBuffer.duration || 2.0) * 1000, 3200);
        this.safetyTimer = setTimeout(fireEnded, safeDurationMs);
        return;
      } catch (e) {
        console.warn('Web Audio source.start failed, falling back to HTMLAudio:', e);
      }
    }

    // 2. Fallback to HTML5 Audio
    try {
      const audio = new Audio(soundFile);
      audio.volume = this.volume;
      this.currentHtmlAudio = audio;

      const onHtmlEnded = () => {
        audio.removeEventListener('ended', onHtmlEnded);
        audio.removeEventListener('error', onHtmlError);
        if (this.currentHtmlAudio === audio) {
          this.currentHtmlAudio = null;
        }
        fireEnded();
      };

      const onHtmlError = () => {
        audio.removeEventListener('ended', onHtmlEnded);
        audio.removeEventListener('error', onHtmlError);
        // Play synthesized chime so child still hears feedback
        this.playSuccessBeep();
        fireEnded();
      };

      audio.addEventListener('ended', onHtmlEnded, { once: true });
      audio.addEventListener('error', onHtmlError, { once: true });

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            if (onStart) onStart();
          })
          .catch(() => {
            // Browser autoplay policy might need another tap
            this.playSuccessBeep();
            setTimeout(fireEnded, 1600);
          });
      }

      // Safety timeout in case audio hangs
      this.safetyTimer = setTimeout(fireEnded, 2400);

      // In the background, load buffer into cache for the next tap
      this.loadBuffer(soundFile).catch(() => {});
    } catch {
      this.playSuccessBeep();
      setTimeout(fireEnded, 1500);
    }
  }

  public playSuccessFanfare() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      const notes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99]; // C E G C E G
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);

        gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.25 * this.volume, ctx.currentTime + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.08 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.4);
      });
    } catch {
      // Ignore
    }
  }

  public playPop() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(750, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.2 * this.volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.09);
    } catch {
      // Ignore
    }
  }

  public playGentleBoing() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(220, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.18 * this.volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } catch {
      // Ignore
    }
  }

  private playSuccessBeep() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.2);

      gain.gain.setValueAtTime(0.2 * this.volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      // Ignore
    }
  }
}

export const audioManager = new AudioManager();
