// Phase 5: original room ambience made with the Web Audio API (no recorded songs).
// Starts with the Enter click (unless turned off before). Each room has its own layer; layers crossfade.
//   lobby: ElevenLabs lounge music (assets/audio/lobby.mp3)
//   lobby / final / corridor: warm gallery pad
//   2000s: phone-style beep melodies + a soft dial-up modem texture
//   Now: muffled concert beat heard "through the wall"
//   2030: synth drone with shimmering pings
// Doorway time-warps play a whoosh.

let ac = null, master = null, noiseBuf = null, enabled = false, room = 'lobby';
// Lobby music (ElevenLabs, OPM-inspired lounge): decoded once and looped gaplessly; fades out in other rooms.
const MUSIC_URL = 'assets/audio/lobby.mp3', MUSIC_LEVEL = 0.75;
let music = null; // { gain, src }
const layers = {};
const LAYER_OF = { lobby: 'gallery', final: 'gallery', corridorV: 'gallery', corridorH: 'gallery', past: 'past', present: 'present', future: 'future' };
const LEVEL = { gallery: 0.5, past: 0.55, present: 0.6, future: 0.6 };

function noise() {
  if (noiseBuf) return noiseBuf;
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}
function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }

function makeLayer(name) {
  const out = ac.createGain(); out.gain.value = 0; out.connect(master);
  const L = { out, nextEvent: 0 };
  if (name === 'gallery') {
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(out);
    [220, 277.18, 329.63, 440].forEach((f, i) => {
      const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.detune.value = (i - 1.5) * 4;
      const g = ac.createGain(); g.gain.value = 0.05; o.connect(g); g.connect(lp); o.start();
      const lfo = ac.createOscillator(); lfo.frequency.value = 0.07 + i * 0.03; const lg = ac.createGain(); lg.gain.value = 0.03; lfo.connect(lg); lg.connect(g.gain); lfo.start();
    });
  }
  if (name === 'future') {
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 6; lp.connect(out);
    [55, 55.35, 82.5].forEach(f => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const g = ac.createGain(); g.gain.value = 0.07; o.connect(g); g.connect(lp); o.start(); });
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.08; const lg = ac.createGain(); lg.gain.value = 260; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    L.event = t => { // shimmering ping
      const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = [880, 1174.66, 1318.5, 1760][Math.floor(Math.random() * 4)];
      const g = ac.createGain(); env(g, t, 0.02, 0.06, 2.4); o.connect(g); g.connect(out); o.start(t); o.stop(t + 2.6);
      return 3 + Math.random() * 4;
    };
  }
  if (name === 'past') {
    L.event = t => {
      if (Math.random() < 0.18) { // dial-up modem texture
        const n = ac.createBufferSource(); n.buffer = noise();
        const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(1200, t); bp.frequency.linearRampToValueAtTime(2400, t + 1.4); bp.Q.value = 3;
        const g = ac.createGain(); env(g, t, 0.05, 0.05, 1.4); n.connect(bp); bp.connect(g); g.connect(out); n.start(t); n.stop(t + 1.6);
        [1270, 2225, 1070].forEach((f, i) => { const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = f; const og = ac.createGain(); env(og, t + i * 0.35, 0.01, 0.015, 0.3); o.connect(og); og.connect(out); o.start(t + i * 0.35); o.stop(t + i * 0.35 + 0.35); });
        return 6 + Math.random() * 4;
      }
      // a short phone-style melody: random notes from a major pentatonic scale
      const scale = [659.25, 739.99, 880, 987.77, 1108.73, 1318.51];
      const n = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = scale[Math.floor(Math.random() * scale.length)];
        const g = ac.createGain(); const ts = t + i * 0.14; env(g, ts, 0.005, 0.03, 0.11); o.connect(g); g.connect(out); o.start(ts); o.stop(ts + 0.13);
      }
      return 4 + Math.random() * 4;
    };
  }
  if (name === 'present') {
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650; lp.connect(out); // "through the wall"
    const beat = 60 / 104; let step = 0;
    L.event = t => {
      const k = ac.createOscillator(); k.type = 'sine'; k.frequency.setValueAtTime(130, t); k.frequency.exponentialRampToValueAtTime(42, t + 0.18);
      const kg = ac.createGain(); env(kg, t, 0.003, 0.5, 0.25); k.connect(kg); kg.connect(lp); k.start(t); k.stop(t + 0.3);
      if (step % 2 === 1) { // clap/snare on 2 and 4
        const n = ac.createBufferSource(); n.buffer = noise(); const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500;
        const g = ac.createGain(); env(g, t, 0.003, 0.18, 0.12); n.connect(bp); bp.connect(g); g.connect(lp); n.start(t); n.stop(t + 0.2);
      }
      if (step % 4 === 0) { // bass note per bar
        const b = ac.createOscillator(); b.type = 'triangle'; b.frequency.value = [55, 55, 49, 61.74][(step / 4) % 4];
        const bg = ac.createGain(); env(bg, t, 0.01, 0.22, beat * 3.5); b.connect(bg); bg.connect(lp); b.start(t); b.stop(t + beat * 4);
      }
      step = (step + 1) % 16;
      return beat;
    };
  }
  return L;
}

function ensure() {
  if (ac) return;
  ac = new (window.AudioContext || window.webkitAudioContext)();
  master = ac.createGain(); master.gain.value = 0.8;
  const comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination);
  for (const n of ['gallery', 'past', 'present', 'future']) layers[n] = makeLayer(n);
  music = { gain: ac.createGain(), src: null };
  music.gain.gain.value = 0; music.gain.connect(master);
  fetch(MUSIC_URL).then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status))
    .then(b => ac.decodeAudioData(b))
    .then(buf => { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(music.gain); s.start(); music.src = s; mix(); })
    .catch(e => console.warn('Lobby music unavailable:', e));
  // Event scheduler: looks ahead a little and schedules the active layer's sounds.
  setInterval(() => {
    if (!enabled) return;
    const L = layers[LAYER_OF[room]];
    if (!L?.event) return;
    const now = ac.currentTime;
    if (L.nextEvent < now) L.nextEvent = now + 0.05;
    while (L.nextEvent < now + 0.25) L.nextEvent += L.event(L.nextEvent);
  }, 80);
}

function mix() {
  if (!ac) return;
  const t = ac.currentTime, active = LAYER_OF[room];
  const musicHere = enabled && room === 'lobby' && !!music?.src;
  for (const [n, L] of Object.entries(layers)) {
    L.out.gain.cancelScheduledValues(t);
    const on = enabled && n === active && !(n === 'gallery' && musicHere); // the music replaces the lobby pad
    L.out.gain.setTargetAtTime(on ? LEVEL[n] : 0, t, 0.6);
  }
  if (music) { music.gain.gain.cancelScheduledValues(t); music.gain.gain.setTargetAtTime(musicHere ? MUSIC_LEVEL : 0, t, musicHere ? 0.8 : 0.5); }
}

export function setRoom(id) { room = id || 'lobby'; mix(); }

export function whoosh() {
  if (!enabled || !ac) return;
  const t = ac.currentTime;
  const n = ac.createBufferSource(); n.buffer = noise();
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.5;
  bp.frequency.setValueAtTime(180, t); bp.frequency.exponentialRampToValueAtTime(3200, t + 0.7); bp.frequency.exponentialRampToValueAtTime(400, t + 1.3);
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
  n.connect(bp); bp.connect(g); g.connect(master); n.start(t); n.stop(t + 1.5);
}

export function setEnabled(on) {
  enabled = on;
  try { localStorage.setItem('cc.sound', on ? '1' : '0'); } catch {}
  if (on) { ensure(); ac.resume(); }
  mix();
  for (const b of document.querySelectorAll('.sound-toggle')) { b.textContent = on ? 'Sound: on' : 'Sound: off'; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }
}
export const isEnabled = () => enabled;
// Sound starts with the Enter click unless the visitor turned it off before.
export function wantsSound() { try { return localStorage.getItem('cc.sound') !== '0'; } catch { return true; } }
export const _debug = () => ({ ctx: ac?.state, room, enabled, gains: Object.fromEntries(Object.entries(layers).map(([n, L]) => [n, +L.out.gain.value.toFixed(3)])), music: music ? { loaded: !!music.src, gain: +music.gain.gain.value.toFixed(3) } : null });
