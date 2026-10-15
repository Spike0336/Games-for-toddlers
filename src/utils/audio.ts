class AudioManager {
  private currentAudio: HTMLAudioElement | null = null;
  private volume: number = 0.9;
  private safetyTimer: NodeJS.Timeout | null = null;
  private audioCache = new Map<string, HTMLAudioElement>();
  private audioCtx: AudioContext | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.getAudioContext();
        window.removeEventListener('click', unlock);
        window.removeEventListener('touchstart', unlock);
      };
      window.addEventListener('click', unlock, { passive: true });
      window.addEventListener('touchstart', unlock, { passive: true });
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public preloadSounds(soundFiles: string[]) {
    if (typeof window === 'undefined') return;
    soundFiles.forEach((src) => {
      if (!this.audioCache.has(src)) {
        try {
          const a = new Audio();
          a.preload = 'auto';
          a.src = src;
          this.audioCache.set(src, a);
        } catch {
          // Safe ignore preload errors
        }
      }
    });
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.currentAudio) {
      this.currentAudio.volume = this.volume;
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

    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {
        // Safe ignore
      }
      this.currentAudio = null;
    }
  }

  public playAnimalSound(
    soundFile: string,
    onEnded?: () => void,
    onStart?: () => void
  ) {
    this.stopCurrent();

    // Soft haptic feedback for toddlers on mobile devices
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(35);
      } catch {
        // Safe ignore
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
      if (this.currentAudio === audio) {
        this.currentAudio = null;
      }
      if (onEnded) onEnded();
    };

    let audio: HTMLAudioElement;
    if (this.audioCache.has(soundFile)) {
      audio = this.audioCache.get(soundFile)!;
      try {
        audio.currentTime = 0;
      } catch {
        // Safe ignore
      }
    } else {
      audio = new Audio(soundFile);
      this.audioCache.set(soundFile, audio);
    }

    audio.volume = this.volume;
    this.currentAudio = audio;

    const onAudioEnded = () => {
      audio.removeEventListener('ended', onAudioEnded);
      audio.removeEventListener('error', onAudioError);
      fireEnded();
    };

    const onAudioError = () => {
      audio.removeEventListener('ended', onAudioEnded);
      audio.removeEventListener('error', onAudioError);
      this.playSynthBeep();
      fireEnded();
    };

    audio.addEventListener('ended', onAudioEnded, { once: true });
    audio.addEventListener('error', onAudioError, { once: true });

    try {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            if (onStart) onStart();
          })
          .catch(() => {
            // Autoplay policy or interaction needed
            this.playSynthBeep();
            setTimeout(fireEnded, 1500);
          });
      } else {
        if (onStart) onStart();
      }
    } catch {
      this.playSynthBeep();
      setTimeout(fireEnded, 1500);
    }

    // Safety timeout: Never leave animal stuck in speaking state if audio stalls
    this.safetyTimer = setTimeout(fireEnded, 3000);
  }

  public playSuccessFanfare() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
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
      // Safe ignore
    }
  }

  public playPop() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
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
      // Safe ignore
    }
  }

  public playGentleBoing() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
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
      // Safe ignore
    }
  }

  private playSynthBeep() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
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
      // Safe ignore
    }
  }
}

export const audioManager = new AudioManager();
