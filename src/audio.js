const tracks = {
  b612: { notes: [262, 392, 330, 294, 349, 262], filter: 235, level: .19, beat: .9 },
  pandora: { notes: [147, 220, 196, 165, 294, 220], filter: 630, level: .21, beat: .78 },
  adrian: { notes: [110, 165, 131, 175, 196, 110], filter: 340, level: .27, beat: 1.15 },
  erid: { notes: [65, 98, 73, 110, 87, 65], filter: 165, level: .08, beat: 1.29 },
  arrakis: { notes: [165, 196, 175, 247, 196, 165], filter: 780, level: .36, beat: .94 },
  miller: { notes: [98, 147, 131, 110, 147, 98], filter: 270, level: .41, beat: 1.2 },
  tatooine: { notes: [196, 294, 262, 220, 247, 196], filter: 480, level: .17, beat: 1.01 }
};

export function createAudio() {
  let context;
  let master;
  let engine;
  let air;
  let melody;
  let phrase;
  let playing;
  let filter;
  let phraseBus;

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
    filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 235;
    ambience.connect(filter).connect(air);
    ambience.start();
  }

  function mix(enabled, screen, looking, id = 'b612', observation = {}) {
    if (enabled && !context) {
      try { init(); } catch { return; }
    }
    if (!context) return;
    if (enabled && context.state !== 'running') context.resume().catch(() => {});
    const at = context.currentTime;
    const arrival = ['orbit', 'rose', 'log', 'surface'].includes(screen);
    const track = tracks[id];
    const shade = id === 'arrakis' && observation.path === 'shade';
    const night = id === 'pandora' && observation.target === 1;
    const level = id === 'tatooine' ? 1 - observation.sky / 240 : 1;
    const signature = enabled && arrival && !looking ? id + (night ? '-night' : '') : null;
    master.gain.setTargetAtTime(enabled ? .38 : 0, at, .035);
    engine.gain.setTargetAtTime(looking ? .05 : arrival ? .04 : .32, at, .16);
    filter.frequency.setTargetAtTime(shade ? 315 : night ? 355 : track.filter, at, .16);
    air.gain.setTargetAtTime(arrival ? track.level * (shade ? .43 : 1) : track.level * .42, at, .16);
    melody.gain.setTargetAtTime(arrival && !looking ? .8 * level : 0, at, .16);
    if (signature === playing) return;
    if (phrase !== undefined) {
      clearInterval(phrase);
      phrase = undefined;
      const previous = phraseBus;
      previous.gain.setTargetAtTime(0, at, .16);
      setTimeout(() => previous.disconnect(), 700);
    }
    playing = signature;
    if (!signature) return;
    phraseBus = context.createGain();
    phraseBus.connect(melody);
    const notes = night ? [147, 440, 196, 262, 587, 220] : track.notes;
    const play = () => {
      notes.forEach((frequency, i) => {
        const time = context.currentTime + i * track.beat + (i > 2 ? .8 : 0);
        note(frequency, time, 2.3, .062, phraseBus);
        note(frequency * 2, time, .95, .013, phraseBus);
      });
    };
    play();
    phrase = setInterval(play, (notes.length * track.beat + 3.4) * 1000);
  }

  function effect() {
    if (!context) return;
    note(670, context.currentTime, .51, .1, master);
  }

  function sonar(target) {
    if (!context) return;
    const start = context.currentTime;
    const duration = target ? .34 : .23;
    const level = target ? .25 / (1 + target.distance * .17) : .21;
    const pitch = target ? 600 - target.distance * 17 : 720;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const panner = context.createStereoPanner();
    panner.pan.value = target ? target.impact[0] / 8 : 0;
    oscillator.frequency.setValueAtTime(pitch, start);
    oscillator.frequency.exponentialRampToValueAtTime(pitch * .54, start + duration);
    envelope.gain.setValueAtTime(.0001, start);
    envelope.gain.exponentialRampToValueAtTime(level, start + .012);
    envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(envelope).connect(panner).connect(master);
    oscillator.onended = () => panner.disconnect();
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  function coverChime() {
    if (!context) return;
    note(740, context.currentTime, .85, .09, master);
    note(1108, context.currentTime + .045, .65, .045, master);
  }
  function eridTones(tones, delay = 0) {
    if (!context) return;
    const frequencies = [294, 392, 587];
    tones.forEach((tone, index) => note(frequencies[tone], context.currentTime + delay + index * .24, .2, .14, master));
  }

  return { mix, coverChime, effect, sonar, eridTones };
}
