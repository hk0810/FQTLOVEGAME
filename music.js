/* =========================================================
   癒しの音楽 — Web Audio APIでその場に生成する
   外部音声ファイルは使わない（容量ゼロ、オフラインでも鳴る）。
   13種類のトラックのうち1つはオルゴール（固定メロディのループ）、
   残り12は「スケール（音階）からゆるやかに選ばれる生成音楽」。
   ========================================================= */

const NOTE_FREQ = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
  C6: 1046.50, D6: 1174.66, E6: 1318.51
};

const MUSIC_TRACKS = [
  { id: "breath",   name: "深呼吸の凪",     wave: "sine",     scale: ["C3","G3","C4","E4","G4"],            tempo: [1800, 3200], duration: 2.6, drone: "C3",  gain: 0.05 },
  { id: "light",    name: "光の粒子",       wave: "triangle", scale: ["C5","D5","E5","G5","A5"],            tempo: [500, 1100],  duration: 1.4, gain: 0.045 },
  { id: "forest",   name: "森のささやき",   wave: "sine",     scale: ["D3","F3","G3","A3","C4"],            tempo: [1400, 2600], duration: 2.2, drone: "D3",  gain: 0.05 },
  { id: "stars",    name: "星降る夜",       wave: "triangle", scale: ["E5","G5","A5","C6","D6"],            tempo: [900, 2000],  duration: 2.0, gain: 0.04 },
  { id: "water",    name: "水面の光",       wave: "sine",     scale: ["C4","E4","G4","A4","C5"],            tempo: [1000, 2000], duration: 1.8, drone: "C3",  gain: 0.05 },
  { id: "dew",      name: "朝露",           wave: "triangle", scale: ["G4","A4","C5","D5","E5"],            tempo: [700, 1500],  duration: 1.6, gain: 0.045 },
  { id: "silence",  name: "静寂の間",       wave: "sine",     scale: ["C3","G3","C4"],                      tempo: [3000, 5000], duration: 3.5, drone: "C3",  gain: 0.045 },
  { id: "orgel",    name: "オルゴールの記憶", wave: "triangle", melody: ["E5","D5","C5","D5","E5","E5","E5","D5","D5","D5","E5","G5","G5","E5","D5","C5","D5","E5","E5","E5","D5","D5","E5","D5","C5"],
    tempo: [420, 420], duration: 0.75, gain: 0.05 },
  { id: "cloud",    name: "雲の航路",       wave: "sine",     scale: ["A3","C4","E4","G4"],                 tempo: [1600, 2800], duration: 2.4, drone: "A3",  gain: 0.05 },
  { id: "wave",     name: "波の記憶",       wave: "sine",     scale: ["D4","F4","A4","C5"],                 tempo: [1200, 2200], duration: 2.0, drone: "D3",  gain: 0.05 },
  { id: "sunlight", name: "木漏れ日",       wave: "triangle", scale: ["G4","B4","D5","E5","G5"],            tempo: [800, 1600],  duration: 1.6, gain: 0.045 },
  { id: "sleep",    name: "眠りの前に",     wave: "sine",     scale: ["C3","E3","G3"],                      tempo: [2600, 4200], duration: 3.8, drone: "C3",  gain: 0.04 },
  { id: "loveLight",name: "愛の灯",         wave: "triangle", scale: ["C4","D4","E4","G4","A4","C5"],       tempo: [900, 1800],  duration: 1.9, drone: "C3",  gain: 0.05 }
];

let audioCtx = null;
let masterGain = null;
let activeTimer = null;
let melodyIndex = 0;
let droneOsc = null, droneGain = null;

function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.7;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
}

function playNote(freq, wave, duration, gainLevel) {
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = wave;
  osc.frequency.value = freq;
  const now = audioCtx.currentTime;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(gainLevel, now + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(g);
  g.connect(masterGain);
  osc.start(now);
  osc.stop(now + duration + 0.1);
}

function startDrone(noteName, gainLevel) {
  stopDrone();
  droneOsc = audioCtx.createOscillator();
  droneGain = audioCtx.createGain();
  droneOsc.type = "sine";
  droneOsc.frequency.value = NOTE_FREQ[noteName];
  droneGain.gain.value = 0;
  droneOsc.connect(droneGain);
  droneGain.connect(masterGain);
  droneOsc.start();
  droneGain.gain.linearRampToValueAtTime(gainLevel * 0.6, audioCtx.currentTime + 2);
}

function stopDrone() {
  if (droneOsc) {
    const now = audioCtx.currentTime;
    droneGain.gain.linearRampToValueAtTime(0, now + 1);
    droneOsc.stop(now + 1.1);
    droneOsc = null; droneGain = null;
  }
}

function scheduleNext(track) {
  const [minT, maxT] = track.tempo;
  const wait = minT + Math.random() * (maxT - minT);
  activeTimer = setTimeout(() => {
    if (track.melody) {
      const note = track.melody[melodyIndex % track.melody.length];
      melodyIndex++;
      playNote(NOTE_FREQ[note], track.wave, track.duration, track.gain);
    } else {
      const note = track.scale[Math.floor(Math.random() * track.scale.length)];
      playNote(NOTE_FREQ[note], track.wave, track.duration, track.gain);
    }
    scheduleNext(track);
  }, wait);
}

function playTrack(trackId) {
  ensureAudio();
  stopTrack();
  const track = MUSIC_TRACKS.find(t => t.id === trackId);
  if (!track) return;
  melodyIndex = 0;
  if (track.drone) startDrone(track.drone, track.gain);
  scheduleNext(track);
}

function stopTrack() {
  if (activeTimer) { clearTimeout(activeTimer); activeTimer = null; }
  stopDrone();
}

function setMusicVolume(v) {
  if (masterGain) masterGain.gain.value = v;
}
