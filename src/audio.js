export function createAudio() {
  let context;
  let master;
  let engine;
  let air;
  let melody;
  let phrase;

  function note(frequency, start, duration, level, destination) {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(.0001, start);
    envelope.gain.exponentialRampToValueAtTime(level, start + .025);
    envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(envelope).connect(destination);
    oscillator.start(start);
    oscillator.stop(start + duration + .02);
  }

  function init() {
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);
    engine = context.createGain();
    air = context.createGain();
    melody = context.createGain();
    for (const channel of [engine, air, melody]) {
      channel.gain.value = 0;
      channel.connect(master);
    }

    for (const frequency of [48, 72.2, 95.8]) {
      const tone = context.createOscillator();
      const amplitude = context.createGain();
      amplitude.gain.value = .16 / (frequency / 45);
      tone.frequency.value = frequency;
      tone.connect(amplitude).connect(engine);
      tone.start();
    }
    const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
    const samples = buffer.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < samples.length; i++) {
      previous = previous * .94 + (Math.random() * 2 - 1) * .06;
      samples[i] = previous;
    }
    const ambience = context.createBufferSource();
    ambience.buffer = buffer;
    ambience.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 235;
    ambience.connect(filter).connect(air);
    ambience.start();
  }

  function mix(enabled, screen, looking) {
    if (enabled && !context) {
      try { init(); } catch { return; }
    }
    if (!context) return;
    if (enabled && context.state !== 'running') context.resume().catch(() => {});
    const at = context.currentTime;
    const arrival = ['orbit', 'rose', 'log'].includes(screen);
    master.gain.setTargetAtTime(enabled ? .38 : 0, at, .035);
    engine.gain.setTargetAtTime(looking ? .05 : arrival ? .05 : .32, at, .15);
    air.gain.setTargetAtTime(arrival ? .19 : .09, at, .15);
    melody.gain.setTargetAtTime(arrival && !looking ? .8 : 0, at, .15);
    if (enabled && arrival && !looking && phrase === undefined) {
      const play = () => {
        const notes = [261.63, 392, 329.63, 293.66, 349.23, 261.63];
        notes.forEach((frequency, i) => {
          const time = context.currentTime + i * .9 + (i > 2 ? 1.05 : 0);
          note(frequency, time, 2.3, .062, melody);
          note(frequency * 2, time, .95, .013, melody);
        });
      };
      play();
      phrase = setInterval(play, 9000);
    } else if ((!enabled || !arrival || looking) && phrase !== undefined) {
      clearInterval(phrase);
      phrase = undefined;
    }
  }

  function coverChime() {
    if (!context) return;
    note(740, context.currentTime, .85, .09, master);
    note(1108, context.currentTime + .045, .65, .045, master);
  }
  return { mix, coverChime };
}
