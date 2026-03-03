// REALITY CORE - Cinematic Sound System (Web Audio API synthesized)
class SoundSystem {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.15;
  }

  init() {
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch(e) { this.enabled = false; }
  }

  ensure() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  // Sci-fi alert tone: rising dual-frequency sweep
  alertCritical() {
    if (!this.enabled) return; this.ensure(); if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Low warning tone
    this.playTone(180, 0.5, 'sine', t, 0.12);
    this.playTone(240, 0.4, 'sine', t + 0.15, 0.1);
    this.playTone(320, 0.5, 'sine', t + 0.3, 0.12);
    // High accent
    this.playTone(880, 0.15, 'sine', t + 0.1, 0.06);
    this.playTone(1100, 0.12, 'sine', t + 0.35, 0.05);
  }

  // Subtle notification blip
  alertInfo() {
    if (!this.enabled) return; this.ensure(); if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.playTone(600, 0.15, 'sine', t, 0.06);
    this.playTone(800, 0.1, 'sine', t + 0.08, 0.05);
  }

  // Data arrival ping
  dataPing() {
    if (!this.enabled) return; this.ensure(); if (!this.ctx) return;
    this.playTone(1200, 0.04, 'sine', this.ctx.currentTime, 0.03);
  }

  // Boot-up sequence sound
  bootSequence() {
    if (!this.enabled) return; this.ensure(); if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [200, 300, 400, 500, 600, 800].forEach((f, i) => {
      this.playTone(f, 0.08, 'sine', t + i * 0.12, 0.06);
    });
  }

  // AI analysis complete chime
  aiChime() {
    if (!this.enabled) return; this.ensure(); if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.playTone(523, 0.1, 'sine', t, 0.08);
    this.playTone(659, 0.1, 'sine', t + 0.1, 0.08);
    this.playTone(784, 0.12, 'sine', t + 0.2, 0.1);
  }

  playTone(freq, vol, type, startTime, duration) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(vol * this.volume, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }
}

window.soundSystem = new SoundSystem();
