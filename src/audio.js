export class AudioEngine {
  constructor() { this.context = null; this.enabled = false; this.volume = .45; this.nextBeat = 0; this.beat = 0; this.bpm = 112; this.timer = null; this.melody = [0, 7, 10, 14, 12, 7, 3, 10]; this.mix = .5; }
  async enable() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return false;
    try {
      this.context ||= new Context();
      this.master ||= this.context.createGain();
      this.master.disconnect();
      this.master.connect(this.context.destination);
      this.master.gain.value = this.volume * .45;
      await this.context.resume();
      this.enabled = true;
      this.nextBeat = this.context.currentTime + .06;
      this.beat = 0;
      clearInterval(this.timer);
      this.timer = setInterval(() => this.schedule(), 25);
      this.schedule();
      return true;
    } catch { return false; }
  }
  disable() { this.enabled = false; clearInterval(this.timer); if (this.master) this.master.gain.setTargetAtTime(0, this.context.currentTime, .03); }
  setVolume(value) { this.volume = value; if (this.master && this.enabled) this.master.gain.setTargetAtTime(value * .45, this.context.currentTime, .03); }
  setTempo(bpm, delay = 0) { this.bpm = bpm; this.beat = 0; if (this.context) this.nextBeat = this.context.currentTime + delay; }
  tone(freq, time, duration = .15, type = 'sine', gain = .25, destination = this.master) {
    if (!this.context || !this.enabled) return;
    const osc = this.context.createOscillator();
    const envelope = this.context.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, time);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(gain, time + .008);
    envelope.gain.exponentialRampToValueAtTime(.001, time + duration);
    osc.connect(envelope); envelope.connect(destination);
    osc.start(time); osc.stop(time + duration + .02);
    osc.onended = () => { osc.disconnect(); envelope.disconnect(); };
  }
  kick(time) {
    if (!this.enabled) return;
    const osc = this.context.createOscillator(), env = this.context.createGain();
    osc.frequency.setValueAtTime(130, time); osc.frequency.exponentialRampToValueAtTime(43, time + .16);
    env.gain.setValueAtTime(.7, time); env.gain.exponentialRampToValueAtTime(.001, time + .22);
    osc.connect(env); env.connect(this.master); osc.start(time); osc.stop(time + .24);
    osc.onended = () => { osc.disconnect(); env.disconnect(); };
  }
  schedule() {
    if (!this.enabled || document.hidden) return;
    const now = this.context.currentTime;
    if (this.nextBeat < now - .2) this.nextBeat = now + .03;
    while (this.nextBeat < now + .1) {
      const t = Math.max(now, this.nextBeat), step = this.beat % 8;
      this.kick(t);
      this.tone(52 * 2 ** ([0, 0, 3, 7][Math.floor(step / 2)] / 12), t + .06, .28, 'triangle', .22);
      this.tone(1800 + step * 100, t + 30 / this.bpm, .025, 'square', .025);
      if (step % 2 === 1) this.tone(220, t, .06, 'triangle', .15);
      const note = this.melody[step];
      this.tone(261.63 * 2 ** (note / 12), t + 15 / this.bpm, .32, 'sine', .08 + this.mix * .09);
      this.nextBeat += 60 / this.bpm;
      this.beat++;
    }
  }
  pad(index) { if (this.enabled) this.tone(261.63 * 2 ** ([0, 3, 7, 10][index] / 12), this.context.currentTime, .5, 'triangle', .3); }
}
