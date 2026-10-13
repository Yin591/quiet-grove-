/* ============================================================
   Audio — HTML5 forest BGM (primary) + WebAudio noise (fallback)
   ============================================================ */
const bgm = document.getElementById('bgm');
bgm.volume = 0;
let bgmLoadedOk = false;
bgm.addEventListener('canplay', () => { bgmLoadedOk = true; });
bgm.addEventListener('error',   () => { bgmLoadedOk = false; });

let webAudioCtx = null;
let webAudioMaster = null;
let webAudioNodes = [];
const audioState = { usingWebAudio: false };

function startWebAudioFallback() {
  if (webAudioCtx) {
    webAudioMaster.gain.cancelScheduledValues(webAudioCtx.currentTime);
    webAudioMaster.gain.linearRampToValueAtTime(0.45, webAudioCtx.currentTime + 3);
    return;
  }
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  webAudioCtx = ctx;
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  webAudioMaster = master;

  // ---- pink-ish noise buffer ----
  const bufSize = ctx.sampleRate * 4;
  const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
  for (let i = 0; i < bufSize; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.96900 * b2 + w * 0.1538520;
    b3 = 0.86650 * b3 + w * 0.3104856;
    b4 = 0.55000 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.0168980;
    nd[i] = (b0+b1+b2+b3+b4+b5+b6 + w*0.5362) * 0.11;
    b6 = w * 0.115926;
  }

  function makeLoop() {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    return src;
  }

  // ---- soft wind: lowpass-filtered noise with slow LFO on cutoff ----
  const wind = makeLoop();
  const windFilter = ctx.createBiquadFilter();
  windFilter.type = 'lowpass';
  windFilter.frequency.value = 380;
  windFilter.Q.value = 0.6;
  const windGain = ctx.createGain();
  windGain.gain.value = 0.55;
  const windLFO = ctx.createOscillator();
  windLFO.frequency.value = 0.08;
  const windLFOGain = ctx.createGain();
  windLFOGain.gain.value = 180;
  windLFO.connect(windLFOGain).connect(windFilter.frequency);
  wind.connect(windFilter).connect(windGain).connect(master);
  wind.start(); windLFO.start();

  // ---- water: bandpass noise with subtle modulation ----
  const water = makeLoop();
  const waterFilter = ctx.createBiquadFilter();
  waterFilter.type = 'bandpass';
  waterFilter.frequency.value = 1200;
  waterFilter.Q.value = 0.9;
  const waterGain = ctx.createGain();
  waterGain.gain.value = 0.38;
  const waterLFO = ctx.createOscillator();
  waterLFO.frequency.value = 0.5;
  const waterLFOGain = ctx.createGain();
  waterLFOGain.gain.value = 350;
  waterLFO.connect(waterLFOGain).connect(waterFilter.frequency);
  water.connect(waterFilter).connect(waterGain).connect(master);
  water.start(); waterLFO.start();

  // ---- high shimmer: very quiet, like distant insects/leaves ----
  const air = makeLoop();
  const airFilter = ctx.createBiquadFilter();
  airFilter.type = 'highpass';
  airFilter.frequency.value = 4200;
  const airGain = ctx.createGain();
  airGain.gain.value = 0.10;
  air.connect(airFilter).connect(airGain).connect(master);
  air.start();

  // ---- occasional bird chirp (sine blip) ----
  function chirp() {
    if (!webAudioCtx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const baseF = 1800 + Math.random() * 1400;
    osc.frequency.setValueAtTime(baseF, now);
    osc.frequency.exponentialRampToValueAtTime(baseF * (1 + (Math.random()-0.5)*0.4), now + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.12, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    osc.connect(g).connect(master);
    osc.start(now); osc.stop(now + 0.3);
    const next = 6 + Math.random() * 14;
    webAudioNodes.push(setTimeout(chirp, next * 1000));
  }
  webAudioNodes.push(setTimeout(chirp, 3000));

  master.gain.linearRampToValueAtTime(0.45, ctx.currentTime + 3);
}

function stopWebAudioFallback() {
  if (!webAudioCtx) return;
  webAudioMaster.gain.cancelScheduledValues(webAudioCtx.currentTime);
  webAudioMaster.gain.linearRampToValueAtTime(0, webAudioCtx.currentTime + 1.6);
  webAudioNodes.forEach(id => clearTimeout(id));
  webAudioNodes = [];
}

/* ---------- Ambient pad — extremely soft sine drones to layer over BGM ---------- */
let padCtx = null, padGain = null, padOscs = [];
function startAmbientPad() {
  if (padCtx) {
    padGain.gain.cancelScheduledValues(padCtx.currentTime);
    padGain.gain.linearRampToValueAtTime(0.08, padCtx.currentTime + 6);
    return;
  }
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  padCtx = ctx;
  const g = ctx.createGain();
  g.gain.value = 0;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1200;
  lp.Q.value = 0.5;
  g.connect(lp).connect(ctx.destination);
  padGain = g;
  // C major pentatonic-ish stack: C3, G3, E4 — open, "piano pad"-like sine drones
  const freqs = [130.81, 196.00, 329.63];
  freqs.forEach((f, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    osc.detune.value = (Math.random() - 0.5) * 6;
    const vg = ctx.createGain();
    vg.gain.value = 0.33;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05 + i * 0.03;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.12;
    lfo.connect(lfoG).connect(vg.gain);
    osc.connect(vg).connect(g);
    osc.start(); lfo.start();
    padOscs.push(osc, lfo);
  });
  g.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 6);
}
function stopAmbientPad() {
  if (!padCtx) return;
  padGain.gain.cancelScheduledValues(padCtx.currentTime);
  padGain.gain.linearRampToValueAtTime(0, padCtx.currentTime + 2);
}

function fadeInBgm() {
  const target = 0.7;
  const step = () => {
    bgm.volume = Math.min(target, bgm.volume + 0.02);
    if (bgm.volume < target) requestAnimationFrame(step);
  };
  step();
}
function fadeOutBgm() {
  const step = () => {
    bgm.volume = Math.max(0, bgm.volume - 0.03);
    if (bgm.volume > 0) requestAnimationFrame(step);
    else bgm.pause();
  };
  step();
}


export { bgm, audioState, startWebAudioFallback, stopWebAudioFallback, startAmbientPad, stopAmbientPad, fadeInBgm, fadeOutBgm };
