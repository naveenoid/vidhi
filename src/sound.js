// Vidhi - Sound Manager
// Procedural audio using Web Audio API: weapon/impact SFX plus a looping
// horror ambience (low drone, sparse distant sounds), alert stingers and
// a low-health heartbeat. Everything routes through a master gain so the
// mix can be ducked during story screens.

class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.initialized = false;
    this.master = null;
    this.ambientNodes = null;
    this.heartbeatTimer = null;
    this.distantTimer = null;
    this.lastStinger = -100;
  }

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio not available');
      this.enabled = false;
    }
  }

  out() {
    return this.master;
  }

  duck(level = 0.25, time = 0.5) {
    if (!this.master) return;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(level, this.ctx.currentTime + time);
  }

  play(sound) {
    if (!this.enabled) return;
    if (!this.initialized) this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    try {
      switch (sound) {
        case 'fire_trishul': this.playTrishulFire(); break;
        case 'fire_agni': this.playAgniFire(); break;
        case 'fire_chakra': this.playChakraFire(); break;
        case 'fire_brahmastra': this.playBrahmastraFire(); break;
        case 'hit': this.playHit(); break;
        case 'hurt': this.playHurt(); break;
        case 'death': this.playDeath(); break;
        case 'enemyDeath': this.playEnemyDeath(); break;
        case 'enemyAttack': this.playEnemyAttack(); break;
        case 'enemyShoot': this.playEnemyShoot(); break;
        case 'pickup': this.playPickup(); break;
        case 'key': this.playKey(); break;
        case 'door': this.playDoor(); break;
        case 'locked': this.playLocked(); break;
        case 'secret': this.playSecret(); break;
        case 'switch': this.playSwitch(); break;
        case 'empty': this.playEmpty(); break;
        case 'explode': this.playExplode(); break;
        case 'levelStart': this.playLevelStart(); break;
        case 'levelComplete': this.playLevelComplete(); break;
        case 'stinger': this.playStinger(); break;
      }
    } catch (e) {
      // Ignore audio errors
    }
  }

  noise(duration, volume = 0.3) {
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * volume;
    }
    return buffer;
  }

  // ---------- Ambience ----------

  startAmbient() {
    if (!this.enabled) return;
    if (!this.initialized) this.init();
    if (!this.ctx || this.ambientNodes) return;

    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.045, t + 4);

    // Two detuned low oscillators through a slowly breathing lowpass
    const oscA = this.ctx.createOscillator();
    oscA.type = 'sawtooth';
    oscA.frequency.value = 52;
    const oscB = this.ctx.createOscillator();
    oscB.type = 'triangle';
    oscB.frequency.value = 52.7;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 180;
    filter.Q.value = 2;

    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 90;
    lfo.connect(lfoGain).connect(filter.frequency);

    oscA.connect(filter);
    oscB.connect(filter);
    filter.connect(gain).connect(this.out());
    oscA.start();
    oscB.start();
    lfo.start();

    this.ambientNodes = { oscA, oscB, lfo, gain };
    this._scheduleDistant();
  }

  stopAmbient() {
    if (!this.ambientNodes) return;
    const { oscA, oscB, lfo, gain } = this.ambientNodes;
    const t = this.ctx.currentTime;
    gain.gain.linearRampToValueAtTime(0, t + 1);
    setTimeout(() => {
      oscA.stop(); oscB.stop(); lfo.stop();
    }, 1200);
    this.ambientNodes = null;
    if (this.distantTimer) clearTimeout(this.distantTimer);
    this.distantTimer = null;
  }

  _scheduleDistant() {
    if (!this.ambientNodes) return;
    this.distantTimer = setTimeout(() => {
      if (this.ambientNodes) {
        this._playDistant();
        this._scheduleDistant();
      }
    }, 7000 + Math.random() * 14000);
  }

  // Faraway noises: a deep thump, a hiss of wind, or a faint metallic ting
  _playDistant() {
    const t = this.ctx.currentTime;
    const pick = Math.random();
    if (pick < 0.4) {
      // Deep distant thump
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(55, t);
      osc.frequency.exponentialRampToValueAtTime(28, t + 0.7);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
      osc.connect(gain).connect(this.out());
      osc.start(t);
      osc.stop(t + 0.9);
    } else if (pick < 0.75) {
      // Wind hiss
      const src = this.ctx.createBufferSource();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      src.buffer = this.noise(2.4, 0.4);
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(300, t);
      filter.frequency.linearRampToValueAtTime(800, t + 1.4);
      filter.Q.value = 3;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.05, t + 1);
      gain.gain.linearRampToValueAtTime(0, t + 2.4);
      src.connect(filter).connect(gain).connect(this.out());
      src.start(t);
    } else {
      // Faint metallic ting echoing
      for (let i = 0; i < 3; i++) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 1100 + Math.random() * 500;
        const start = t + i * 0.5;
        gain.gain.setValueAtTime(0.03 / (i + 1), start);
        gain.gain.exponentialRampToValueAtTime(0.0005, start + 0.4);
        osc.connect(gain).connect(this.out());
        osc.start(start);
        osc.stop(start + 0.4);
      }
    }
  }

  // Dissonant sting when an enemy spots you (throttled by caller via time)
  playStinger() {
    const now = this.ctx.currentTime;
    if (now - this.lastStinger < 8) return;
    this.lastStinger = now;
    // Minor-second cluster swelling fast then dying
    for (const freq of [220, 233, 440]) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.05, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
      osc.connect(gain).connect(this.out());
      osc.start(now);
      osc.stop(now + 1.1);
    }
  }

  setHeartbeat(on) {
    if (on && !this.heartbeatTimer && this.ctx) {
      const beat = () => {
        this._thump(0.09);
        setTimeout(() => this._thump(0.06), 180);
      };
      beat();
      this.heartbeatTimer = setInterval(beat, 950);
    } else if (!on && this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  _thump(vol) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(58, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.12);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(gain).connect(this.out());
    osc.start(t);
    osc.stop(t + 0.15);
  }

  // ---------- SFX ----------

  playTrishulFire() {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.15);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain).connect(this.out());
    osc.start(t);
    osc.stop(t + 0.2);
  }

  playAgniFire() {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.3);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(gain).connect(this.out());
    osc.start(t);
    osc.stop(t + 0.3);

    const src = this.ctx.createBufferSource();
    const noiseGain = this.ctx.createGain();
    src.buffer = this.noise(0.2, 0.4);
    noiseGain.gain.setValueAtTime(0.2, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    src.connect(noiseGain).connect(this.out());
    src.start(t);
  }

  playChakraFire() {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.2);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain).connect(this.out());
    osc.start(t);
    osc.stop(t + 0.25);
  }

  playBrahmastraFire() {
    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(60, t);
    osc1.frequency.exponentialRampToValueAtTime(30, t + 0.5);
    gain1.gain.setValueAtTime(0.3, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc1.connect(gain1).connect(this.out());
    osc1.start(t);
    osc1.stop(t + 0.5);

    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1200, t);
    osc2.frequency.exponentialRampToValueAtTime(200, t + 0.4);
    gain2.gain.setValueAtTime(0.1, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc2.connect(gain2).connect(this.out());
    osc2.start(t);
    osc2.stop(t + 0.4);
  }

  playHit() {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.08);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(gain).connect(this.out());
    osc.start(t);
    osc.stop(t + 0.1);
  }

  playHurt() {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.2);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain).connect(this.out());
    osc.start(t);
    osc.stop(t + 0.25);
  }

  playDeath() {
    const t = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200 - i * 30, t + i * 0.15);
      osc.frequency.exponentialRampToValueAtTime(40, t + i * 0.15 + 0.3);
      gain.gain.setValueAtTime(0.15, t + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.15 + 0.3);
      osc.connect(gain).connect(this.out());
      osc.start(t + i * 0.15);
      osc.stop(t + i * 0.15 + 0.3);
    }
  }

  // Guttural descending growl-roar
  playEnemyDeath() {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.6);
    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    // Growl wobble
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 28;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 30;
    lfo.connect(lfoGain).connect(osc.frequency);
    osc.connect(gain).connect(this.out());
    osc.start(t);
    osc.stop(t + 0.6);
    lfo.start(t);
    lfo.stop(t + 0.6);
  }

  playEnemyAttack() {
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    src.buffer = this.noise(0.15, 0.3);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    src.connect(gain).connect(this.out());
    src.start(t);

    // Snarl underneath
    const osc = this.ctx.createOscillator();
    const g2 = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.18);
    g2.gain.setValueAtTime(0.08, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(g2).connect(this.out());
    osc.start(t);
    osc.stop(t + 0.18);
  }

  // Naga venom bolt: wet hiss-spit
  playEnemyShoot() {
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    src.buffer = this.noise(0.25, 0.5);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3000, t);
    filter.frequency.exponentialRampToValueAtTime(700, t + 0.22);
    filter.Q.value = 2;
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    src.connect(filter).connect(gain).connect(this.out());
    src.start(t);
  }

  playPickup() {
    const t = this.ctx.currentTime;
    const notes = [523, 659, 784];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.08);
      gain.gain.setValueAtTime(0.1, t + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.15);
      osc.connect(gain).connect(this.out());
      osc.start(t + i * 0.08);
      osc.stop(t + i * 0.08 + 0.15);
    });
  }

  playKey() {
    const t = this.ctx.currentTime;
    const notes = [440, 554, 659, 880];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.1);
      gain.gain.setValueAtTime(0.1, t + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.2);
      osc.connect(gain).connect(this.out());
      osc.start(t + i * 0.1);
      osc.stop(t + i * 0.1 + 0.2);
    });
  }

  playDoor() {
    const t = this.ctx.currentTime;
    // Heavy stone rumble
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(45, t);
    osc.frequency.linearRampToValueAtTime(70, t + 0.6);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    osc.connect(gain).connect(this.out());
    osc.start(t);
    osc.stop(t + 0.7);

    const src = this.ctx.createBufferSource();
    const ngain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    src.buffer = this.noise(0.6, 0.3);
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    ngain.gain.setValueAtTime(0.1, t);
    ngain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    src.connect(filter).connect(ngain).connect(this.out());
    src.start(t);
  }

  playLocked() {
    const t = this.ctx.currentTime;
    // Dull rattle: two quick knocks
    for (let i = 0; i < 2; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 120;
      gain.gain.setValueAtTime(0.08, t + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.08);
      osc.connect(gain).connect(this.out());
      osc.start(t + i * 0.12);
      osc.stop(t + i * 0.12 + 0.08);
    }
  }

  playSecret() {
    const t = this.ctx.currentTime;
    const notes = [330, 415, 494, 659];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.09);
      gain.gain.setValueAtTime(0.09, t + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.3);
      osc.connect(gain).connect(this.out());
      osc.start(t + i * 0.09);
      osc.stop(t + i * 0.09 + 0.3);
    });
  }

  playSwitch() {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.setValueAtTime(800, t + 0.05);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(gain).connect(this.out());
    osc.start(t);
    osc.stop(t + 0.1);
  }

  playEmpty() {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, t);
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(gain).connect(this.out());
    osc.start(t);
    osc.stop(t + 0.08);
  }

  playExplode() {
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    src.buffer = this.noise(0.5, 0.5);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    src.connect(gain).connect(this.out());
    src.start(t);

    const osc = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.5);
    gain2.gain.setValueAtTime(0.2, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(gain2).connect(this.out());
    osc.start(t);
    osc.stop(t + 0.5);
  }

  // Low ominous swell instead of the old cheerful arpeggio
  playLevelStart() {
    const t = this.ctx.currentTime;
    for (const [freq, delay] of [[65, 0], [98, 0.3], [130, 0.6]]) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.08, t + delay + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 1.6);
      osc.connect(gain).connect(this.out());
      osc.start(t + delay);
      osc.stop(t + delay + 1.6);
    }
  }

  playLevelComplete() {
    const t = this.ctx.currentTime;
    const notes = [523, 659, 784, 1047, 784, 1047];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.12);
      gain.gain.setValueAtTime(0.1, t + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.25);
      osc.connect(gain).connect(this.out());
      osc.start(t + i * 0.12);
      osc.stop(t + i * 0.12 + 0.25);
    });
  }
}

export { SoundManager };
