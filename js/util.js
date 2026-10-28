/* append und prepend ignorieren leere Werte, damit bedingte Elemente einfach bleiben */
for (const proto of [Element.prototype, DocumentFragment.prototype]) {
  for (const fn of ['append', 'prepend']) {
    const orig = proto[fn];
    proto[fn] = function (...nodes) { return orig.apply(this, nodes.filter(n => n !== null && n !== undefined && n !== false)); };
  }
}

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

export function toast(text, kind = 'info') {
  const t = h('div', { class: 'toast toast-' + kind, role: 'status' }, text);
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3200);
}

export function loader(text) {
  return h('div', { class: 'loader' }, h('span', { class: 'dots' }, h('i'), h('i'), h('i')), h('span', {}, text));
}

export function normalize(s, lang) {
  let t = String(s || '').toLowerCase().normalize('NFC');
  t = t.replace(/[.,!?¿¡;:"'«»„“”‚‘’()\[\]{}…、。！？「」『』・]/g, ' ');
  return t.replace(/\s+/g, ' ').trim();
}

export function tokens(s, lang) {
  const n = normalize(s, lang);
  if (lang === 'ja') return Array.from(n.replace(/\s/g, ''));
  return n ? n.split(' ') : [];
}

/* Vergleicht Zielsatz und gesprochenen Satz, liefert pro Zielwort ob es getroffen wurde */
export function compareSpeech(target, said, lang) {
  const a = tokens(target, lang);
  const b = tokens(said, lang);
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const hit = new Array(a.length).fill(false);
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { hit[i] = true; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  const score = a.length ? Math.round((dp[0][0] / a.length) * 100) : 0;
  return { words: a.map((w, k) => ({ w, ok: hit[k] })), score };
}

/* Zeichengenauer Vergleich für Abschreiben und Fehlerkartei */
export function charDiff(expected, typed) {
  const a = Array.from(expected), b = Array.from(typed);
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--)
    dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { out.push({ c: a[i], t: 'same' }); i++; j++; }
    else if (j < b.length && (i >= a.length || dp[i][j + 1] >= dp[i + 1][j])) { out.push({ c: b[j], t: 'extra' }); j++; }
    else { out.push({ c: a[i], t: 'missing' }); i++; }
  }
  return out;
}

export function minutes(sec) { return Math.round((sec || 0) / 60); }

export function store(key, value) {
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem('le_' + key));
    if (value === null) localStorage.removeItem('le_' + key);
    else localStorage.setItem('le_' + key, JSON.stringify(value));
  } catch (e) { return undefined; }
}

export const LANGS = {
  it: { name: 'Italienisch', short: 'IT', figure: 'Espresso', hello: 'Ciao!', clips: true, color: '#E07A4F', color2: '#F2D3B3', ink: '#3B2116' },
  ja: { name: 'Japanisch', short: 'JA', figure: 'Matcha', hello: 'こんにちは!', clips: true, color: '#8FC46F', color2: '#F7B8C8', ink: '#1F3317' },
  fr: { name: 'Französisch', short: 'FR', figure: 'Macaron', hello: 'Coucou !', clips: true, color: '#F29AB0', color2: '#9FD8C1', ink: '#3A1E27' },
  en: { name: 'Englisch', short: 'EN', figure: 'Scone', hello: 'Hello there!', clips: true, color: '#C8443F', color2: '#3E8A63', ink: '#2A1312' },
  de: { name: 'Deutsch', short: 'DE', figure: 'Brezel', hello: 'Hallo!', clips: true, color: '#D9963B', color2: '#F5E6C8', ink: '#3A2410' }
};

/* Zwei Lernblöcke: ähnliche Sprachen landen nie direkt hintereinander */
export const BLOCKS = [
  { name: 'Vormittag', langs: ['it', 'ja'] },
  { name: 'Nachmittag', langs: ['fr', 'en', 'de'] }
];
