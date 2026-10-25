import { api } from './api.js';

const cache = new Map();
const player = new Audio();
player.preload = 'auto';
let currentStop = null;

const BCP = { fr: 'fr-FR', it: 'it-IT', ja: 'ja-JP', en: 'en-GB', de: 'de-DE' };

export async function fetchSpeech(text, lang) {
  const key = lang + '|' + text;
  if (cache.has(key)) return cache.get(key);
  const p = api.audio('/api/tts', { text, lang }).then(b => URL.createObjectURL(b));
  cache.set(key, p);
  p.catch(() => cache.delete(key));
  return p;
}

export function stopSpeaking() {
  if (currentStop) currentStop();
  currentStop = null;
  try { player.pause(); } catch (e) {}
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

/* Spielt Text ab. Hooks: onStart, onEnd. rate verlangsamt ohne Tonhöhe zu ändern. */
export async function say(text, lang, { rate = 1, onStart, onEnd } = {}) {
  stopSpeaking();
  if (!text) return;
  let finished = false;
  const done = () => { if (finished) return; finished = true; onEnd && onEnd(); };
  try {
    const url = await fetchSpeech(text, lang);
    await new Promise((resolve) => {
      currentStop = () => { done(); resolve(); };
      player.src = url;
      player.playbackRate = rate;
      player.preservesPitch = true;
      player.onended = () => { done(); resolve(); };
      player.onerror = () => { done(); resolve(); };
      player.play().then(() => onStart && onStart()).catch(() => { done(); resolve(); });
    });
  } catch (e) {
    if (!('speechSynthesis' in window)) { done(); return; }
    await new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = BCP[lang] || lang;
      u.rate = rate;
      u.onstart = () => onStart && onStart();
      u.onend = () => { done(); resolve(); };
      u.onerror = () => { done(); resolve(); };
      currentStop = () => { speechSynthesis.cancel(); done(); resolve(); };
      speechSynthesis.speak(u);
    });
  }
}

export function preload(texts, lang) {
  texts.filter(Boolean).slice(0, 20).forEach(t => fetchSpeech(t, lang).catch(() => {}));
}

/* Aufnahme per Tippen starten und stoppen */
export class Recorder {
  constructor() { this.chunks = []; this.rec = null; this.stream = null; }
  get active() { return !!(this.rec && this.rec.state === 'recording'); }
  async start() {
    if (!navigator.mediaDevices || !window.MediaRecorder) throw new Error('Dieser Browser kann keine Aufnahmen machen');
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
    const type = types.find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t));
    this.rec = new MediaRecorder(this.stream, type ? { mimeType: type } : undefined);
    this.chunks = [];
    this.rec.ondataavailable = (e) => { if (e.data && e.data.size) this.chunks.push(e.data); };
    this.startedAt = Date.now();
    this.rec.start();
  }
  stop() {
    return new Promise((resolve) => {
      if (!this.rec) return resolve(null);
      this.rec.onstop = () => {
        const type = (this.rec.mimeType || 'audio/webm');
        const blob = new Blob(this.chunks, { type });
        this.stream.getTracks().forEach(t => t.stop());
        this.rec = null;
        resolve(Date.now() - this.startedAt < 400 ? null : blob);
      };
      this.rec.stop();
    });
  }
}

export async function transcribe(blob, lang, hint) {
  const qs = new URLSearchParams({ lang: lang || '' });
  if (hint) qs.set('hint', hint.slice(0, 300));
  const r = await api.upload('/api/stt?' + qs.toString(), blob);
  return r.text || '';
}
