import { h, LANGS } from './util.js';

const STATES = ['idle', 'listen', 'talk', 'happy', 'think'];

const FACE = `
  <g class="face">
    <g class="eyes"><ellipse cx="-17" cy="0" rx="6" ry="8" fill="#2B1B17"/><ellipse cx="17" cy="0" rx="6" ry="8" fill="#2B1B17"/>
    <circle cx="-15" cy="-3" r="2.2" fill="#fff"/><circle cx="19" cy="-3" r="2.2" fill="#fff"/></g>
    <ellipse cx="-30" cy="12" rx="7" ry="4.5" fill="#F59BB0" opacity=".8"/><ellipse cx="30" cy="12" rx="7" ry="4.5" fill="#F59BB0" opacity=".8"/>
    <path class="mouth" d="M-8 13 Q0 22 8 13 Q0 17 -8 13Z" fill="#7A2E2E" stroke="#2B1B17" stroke-width="2" stroke-linejoin="round"/>
  </g>`;

const SVGS = {
  ja: `<svg viewBox="-100 -150 200 300" class="fig" aria-hidden="true">
    <ellipse cx="0" cy="138" rx="56" ry="8" fill="#000" opacity=".12"/>
    <g class="body">
      <path d="M-62 -60 L62 -60 L48 120 Q0 132 -48 120 Z" fill="#FFFDF7" stroke="#2B1B17" stroke-width="4" stroke-linejoin="round"/>
      <path d="M-58 -10 L58 -10 L54 40 L-54 40 Z" fill="#A9D18E" stroke="#2B1B17" stroke-width="3"/>
      <circle cx="40" cy="70" r="9" fill="#F7B8C8" stroke="#2B1B17" stroke-width="2"/>
      <path d="M-72 -62 Q0 -110 72 -62 Z" fill="#fff" stroke="#2B1B17" stroke-width="4" stroke-linejoin="round"/>
      <rect x="-74" y="-66" width="148" height="12" rx="6" fill="#fff" stroke="#2B1B17" stroke-width="4"/>
      <path d="M-10 -94 q10 -14 20 0" fill="#8FC46F" stroke="#2B1B17" stroke-width="3"/>
      <g transform="translate(0 15)">${FACE}</g>
      <path class="arm l" d="M-60 30 q-22 8 -20 30" fill="none" stroke="#2B1B17" stroke-width="10" stroke-linecap="round"/>
      <path class="arm r" d="M60 30 q22 8 20 30" fill="none" stroke="#2B1B17" stroke-width="10" stroke-linecap="round"/>
      <path d="M-70 -34 C-74 -132 74 -132 70 -34" fill="none" stroke="#2B1B17" stroke-width="14" stroke-linecap="round"/><path d="M-70 -34 C-74 -132 74 -132 70 -34" fill="none" stroke="#9FD8A0" stroke-width="8" stroke-linecap="round"/>
      <rect x="-80" y="-48" width="20" height="34" rx="9" fill="#9FD8A0" stroke="#2B1B17" stroke-width="3"/>
      <rect x="60" y="-48" width="20" height="34" rx="9" fill="#9FD8A0" stroke="#2B1B17" stroke-width="3"/>
      <ellipse cx="-24" cy="130" rx="13" ry="9" fill="#FFFDF7" stroke="#2B1B17" stroke-width="3"/>
      <ellipse cx="24" cy="130" rx="13" ry="9" fill="#FFFDF7" stroke="#2B1B17" stroke-width="3"/>
    </g></svg>`,
  en: `<svg viewBox="-100 -150 200 300" class="fig" aria-hidden="true">
    <ellipse cx="0" cy="118" rx="62" ry="8" fill="#000" opacity=".12"/>
    <g class="body">
      <path d="M-76 40 Q-82 -40 -40 -62 Q0 -78 40 -62 Q82 -40 76 40 Q70 100 0 102 Q-70 100 -76 40Z" fill="#E7B062" stroke="#2B1B17" stroke-width="4"/>
      <path d="M-70 10 Q0 30 70 10" fill="none" stroke="#C88A3E" stroke-width="5" stroke-linecap="round"/>
      <path d="M-46 -60 Q-30 -100 0 -92 Q34 -104 46 -62 Q0 -50 -46 -60Z" fill="#FFF6E2" stroke="#2B1B17" stroke-width="4"/>
      <path d="M-16 -94 Q0 -112 18 -96 Q2 -88 -16 -94Z" fill="#D2334A" stroke="#2B1B17" stroke-width="3"/>
      <g transform="translate(0 30)">${FACE}</g>
      <path d="M-72 62 Q0 92 72 62 L66 78 Q0 104 -66 78Z" fill="#C8443F" stroke="#2B1B17" stroke-width="3"/>
      <path d="M-40 70 v22 M-10 76 v22 M20 76 v22 M48 70 v20" stroke="#2F6B4F" stroke-width="5"/>
      <path class="arm l" d="M-74 40 q-22 8 -20 30" fill="none" stroke="#2B1B17" stroke-width="10" stroke-linecap="round"/>
      <path class="arm r" d="M74 40 q22 8 20 30" fill="none" stroke="#2B1B17" stroke-width="10" stroke-linecap="round"/>
      <path d="M-74 -24 C-80 -140 80 -140 74 -24" fill="none" stroke="#2B1B17" stroke-width="14" stroke-linecap="round"/><path d="M-74 -24 C-80 -140 80 -140 74 -24" fill="none" stroke="#9FD8A0" stroke-width="8" stroke-linecap="round"/>
      <rect x="-84" y="-40" width="20" height="34" rx="9" fill="#9FD8A0" stroke="#2B1B17" stroke-width="3"/>
      <rect x="64" y="-40" width="20" height="34" rx="9" fill="#9FD8A0" stroke="#2B1B17" stroke-width="3"/>
      <ellipse cx="-26" cy="108" rx="13" ry="9" fill="#E7B062" stroke="#2B1B17" stroke-width="3"/>
      <ellipse cx="26" cy="108" rx="13" ry="9" fill="#E7B062" stroke="#2B1B17" stroke-width="3"/>
    </g></svg>`
};

/* Randfarbe jedes Clips, damit der Hintergrund nahtlos in den Bogen übergeht */
const CLIP_BG = {"fr": {"idle": "#C9C2C2", "listen": "#E6E2E6", "talk": "#E0DAD6", "happy": "#D2CCCB", "think": "#CAC3C2"}, "it": {"idle": "#DAD4CE", "listen": "#D8D5D4", "talk": "#DAD8D7", "happy": "#DAD4CF", "think": "#DFD8D6"}, "ja": {"idle": "#E6E0E0", "listen": "#DFDCE0", "talk": "#E4E2E4", "happy": "#DFDCE1", "think": "#E8E4EA"}, "en": {"idle": "#E2DAD6", "listen": "#DED8D8", "talk": "#D2CAC7", "happy": "#DCD3D0", "think": "#DAD3CE"}, "de": {"idle": "#D7CBC6", "listen": "#D6CECF", "talk": "#DED3CE", "happy": "#E3E0E0", "think": "#CCCACE"}};

export function figureSvg(lang) { return SVGS[lang] || ''; }

export class Avatar {
  constructor(lang, { small = false } = {}) {
    this.lang = lang;
    this.state = 'idle';
    this.meta = LANGS[lang];
    this.el = h('div', { class: 'stage' + (small ? ' small' : ''), 'data-state': 'idle', 'data-lang': lang });
    this.inner = h('div', { class: 'stage-inner' });
    this.el.append(this.inner);
    this.videos = {};
    if (this.meta.clips) {
      for (const s of STATES) {
        const v = h('video', {
          src: `avatars/${lang}/${s}.mp4`, muted: true, playsinline: true, loop: s !== 'happy',
          preload: s === 'idle' ? 'auto' : 'metadata', poster: s === 'idle' ? `avatars/${lang}/poster.jpg` : null,
          class: 'clip' + (s === 'idle' ? ' on' : ''), 'aria-hidden': 'true'
        });
        v.muted = true;
        this.videos[s] = v;
        this.inner.append(v);
      }
      this.videos.idle.play().catch(() => {});
      this.paintBg('idle');
      this.videos.happy.addEventListener('ended', () => { if (this.state === 'happy') this.set('idle'); });
    } else {
      this.inner.classList.add('svg-figure');
      this.inner.innerHTML = SVGS[lang] || SVGS.en;
    }
    this.el.append(h('div', { class: 'stage-tint' }));
  }

  set(state) {
    if (!STATES.includes(state) || state === this.state) return;
    this.state = state;
    this.el.dataset.state = state;
    if (!this.meta.clips) {
      if (state === 'happy') { clearTimeout(this.ht); this.ht = setTimeout(() => this.set('idle'), 1800); }
      return;
    }
    const v = this.videos[state];
    try { v.currentTime = 0; } catch (e) {}
    v.play().catch(() => {});
    for (const s of STATES) this.videos[s].classList.toggle('on', s === state);
    this.paintBg(state);
    setTimeout(() => {
      for (const s of STATES) if (s !== this.state) this.videos[s].pause();
    }, 260);
  }

  paintBg(state) {
    const c = CLIP_BG[this.lang] && CLIP_BG[this.lang][state];
    if (c) this.el.style.backgroundColor = c;
  }

  cheer() { this.set('happy'); }
}
