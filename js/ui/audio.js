// ============================================================
// AUDIO.JS — AudioManager
// Todos os efeitos são sintetizados via WebAudio API (osciladores),
// então o jogo não depende de nenhum arquivo de áudio externo.
// ============================================================
import { CONFIG } from '../core/config.js';

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem(CONFIG.STORAGE_KEYS.muted) === 'true';
    this.musicNodes = null;
    this.musicPlaying = false;
  }

  // O AudioContext só pode ser criado após interação do usuário (política dos navegadores)
  ensureContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    localStorage.setItem(CONFIG.STORAGE_KEYS.muted, String(muted));
    if (muted) this.stopMusic();
    else if (this.wantMusic) this.startMusic();
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  // ---------------- SFX genérico via oscilador com envelope ----------------
  _beep({ freq = 440, type = 'sine', duration = 0.12, gain = 0.18, glideTo = null }) {
    if (this.muted) return;
    this.ensureContext();
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + duration);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  jump() { this._beep({ freq: 320, type: 'triangle', duration: 0.16, glideTo: 520 }); }
  slide() { this._beep({ freq: 220, type: 'triangle', duration: 0.14, glideTo: 120 }); }
  coin() { this._beep({ freq: 780, type: 'square', duration: 0.09, gain: 0.12, glideTo: 1180 }); }
  powerup() {
    if (this.muted) return;
    this.ensureContext();
    [660, 880, 1100].forEach((f, i) => {
      setTimeout(() => this._beep({ freq: f, type: 'sine', duration: 0.12, gain: 0.14 }), i * 70);
    });
  }
  hit() { this._beep({ freq: 140, type: 'sawtooth', duration: 0.22, gain: 0.22, glideTo: 60 }); }
  gameover() {
    if (this.muted) return;
    this.ensureContext();
    [440, 330, 220, 140].forEach((f, i) => {
      setTimeout(() => this._beep({ freq: f, type: 'sawtooth', duration: 0.28, gain: 0.16 }), i * 130);
    });
  }
  uiClick() { this._beep({ freq: 500, type: 'square', duration: 0.05, gain: 0.08 }); }

  // ---------------- Música de fundo (loop simples de arpejo) ----------------
  startMusic() {
    this.wantMusic = true;
    if (this.muted || this.musicPlaying) return;
    this.ensureContext();
    this.musicPlaying = true;

    const notes = [220, 261.6, 329.6, 392, 329.6, 261.6]; // arpejo simples em Am
    let step = 0;
    const master = this.ctx.createGain();
    master.gain.value = 0.05;
    master.connect(this.ctx.destination);

    this.musicNodes = { master };

    this.musicInterval = setInterval(() => {
      if (this.muted || !this.musicPlaying) return;
      const freq = notes[step % notes.length];
      step++;
      const t0 = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.35, t0 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.38);
      osc.connect(g).connect(master);
      osc.start(t0);
      osc.stop(t0 + 0.4);
    }, 260);
  }

  stopMusic() {
    this.musicPlaying = false;
    if (this.musicInterval) clearInterval(this.musicInterval);
  }
}
