// Synthesised sound effects. No sample files (CLAUDE.md §5).

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  /** Call from a user gesture (browsers block audio until then). */
  unlock(): void {
    if (this.ctx) { void this.ctx.resume(); return; }
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0): void {
    const c = this.ctx;
    if (!c || !this.master) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, filterHz: number, delay = 0): void {
    const c = this.ctx;
    if (!c || !this.master) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterHz;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start(c.currentTime + delay);
  }

  step(): void { this.noise(0.05, 0.12, 900); }
  pick(): void { this.tone(880, 0.06, 'square', 0.12, 440); this.noise(0.08, 0.25, 3000); }
  mined(): void { this.tone(660, 0.08, 'triangle', 0.2); this.tone(990, 0.12, 'triangle', 0.2, undefined, 0.07); }
  lampCharge(red: boolean): void { this.tone(red ? 220 : 330, 2, 'sine', 0.12, red ? 660 : 990); }
  lampOn(red: boolean): void { this.tone(red ? 440 : 660, 0.4, 'triangle', 0.18); this.tone(red ? 554 : 830, 0.5, 'sine', 0.12, undefined, 0.05); }
  lampOff(): void { this.tone(300, 0.4, 'sine', 0.1, 120); }
  crack(): void { this.noise(0.25, 0.5, 1800); this.tone(140, 0.2, 'sawtooth', 0.1, 70); }
  fall(): void { this.tone(500, 0.9, 'sawtooth', 0.15, 60); this.noise(0.6, 0.4, 500, 0.5); }
  rumble(long: boolean): void { this.noise(long ? 2.2 : 1.2, long ? 0.8 : 0.4, 160); }
  checkpoint(): void { [523, 659, 784].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.15, undefined, i * 0.09)); }
  coin(): void { this.tone(988, 0.08, 'square', 0.1); this.tone(1319, 0.2, 'square', 0.1, undefined, 0.08); }
  deny(): void { this.tone(160, 0.18, 'square', 0.12); }
  warn(): void { this.tone(880, 0.12, 'square', 0.1); this.tone(660, 0.12, 'square', 0.1, undefined, 0.15); }
  lift(): void { this.tone(110, 1.2, 'sawtooth', 0.08, 220); }
}
