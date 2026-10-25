import { h, clear, toast, loader, store, LANGS, BLOCKS, minutes } from './util.js';
import { api, apiBase, setApiBase, token, AuthError } from './api.js';
import { setWorld, countUp, spotlight, initClickSpark, stagger } from './fx.js';
import { Avatar, figureSvg } from './avatar.js';
import { stopSpeaking } from './audio.js';
import { renderLesson } from './lesson.js';
import { renderChat } from './chat.js';
import { renderReview } from './review.js';
import { renderListen } from './listen.js';
import { renderDaily, dailyCard } from './daily.js';
import { renderGerman } from './german.js';

const main = document.getElementById('main');
const nav = document.getElementById('nav');

export const app = {
  profiles: [],
  profile: null,
  overview: null,
  cleanup: null,
  timer: null
};

/* Lernzeit pro Sprache mitzählen */
const session = {
  lang: null, seconds: 0, lastTick: 0,
  start(lang) {
    this.flush();
    this.lang = lang; this.seconds = 0; this.lastTick = Date.now();
    clearInterval(app.timer);
    app.timer = setInterval(() => this.tick(), 15000);
  },
  tick() {
    if (!this.lang || document.hidden) { this.lastTick = Date.now(); return; }
    const now = Date.now();
    this.seconds += Math.min(60, Math.round((now - this.lastTick) / 1000));
    this.lastTick = now;
    if (this.seconds >= 60) this.flush(true);
  },
  flush(keep) {
    if (this.lang && this.seconds > 0 && app.profile) {
      api.post('/api/usage', { profileId: app.profile.id, lang: this.lang, seconds: this.seconds }).catch(() => {});
      app.todaySeconds = (app.todaySeconds || 0) + this.seconds;
    }
    this.seconds = 0;
    if (!keep) { this.lang = null; clearInterval(app.timer); }
  }
};
addEventListener('pagehide', () => session.flush());
document.addEventListener('visibilitychange', () => { if (document.hidden) session.flush(true); });

export function go(path) { location.hash = '#/' + path; }

function renderNav(active) {
  clear(nav);
  if (!app.profile) { nav.hidden = true; return; }
  nav.hidden = false;
  const langs = app.profile.languages || [];
  const pill = (label, path, isActive, extra = {}) =>
    h('a', { class: 'pill' + (isActive ? ' active' : ''), href: '#/' + path, ...extra }, label);
  nav.append(
    pill(app.profile.name, 'home', active === 'home', { 'aria-label': 'Startseite' }),
    h('span', { class: 'nav-langs' }, langs.map(l => pill(LANGS[l].short, 'learn/' + l, active === l, { title: LANGS[l].name, 'data-lang': l }))),
    pill('⚙', 'settings', active === 'settings', { 'aria-label': 'Einstellungen', title: 'Einstellungen' })
  );
}

function teardown() {
  stopSpeaking();
  if (app.cleanup) { try { app.cleanup(); } catch (e) {} app.cleanup = null; }
}

/* Anmeldung */
function viewLogin(msg) {
  setWorld(null); renderNav();
  const server = h('input', { type: 'url', placeholder: 'https://dein-backend.up.railway.app', value: apiBase(), autocomplete: 'url', id: 'server' });
  const pw = h('input', { type: 'password', placeholder: 'Familien-Passwort', autocomplete: 'current-password', id: 'pw' });
  const err = h('p', { class: 'error', role: 'alert' }, msg || '');
  const btn = h('button', { class: 'btn primary', type: 'submit' }, 'Anmelden');
  const form = h('form', { class: 'card login reveal', onsubmit: async (e) => {
    e.preventDefault();
    err.textContent = '';
    if (!server.value.trim()) { err.textContent = 'Trag zuerst die Adresse deines Backends ein.'; return; }
    setApiBase(server.value);
    btn.disabled = true; btn.textContent = 'Melde an …';
    try { await api.login(pw.value); go('profiles'); }
    catch (e2) { err.textContent = e2.message; }
    finally { btn.disabled = false; btn.textContent = 'Anmelden'; }
  } },
    h('h1', { class: 'shiny' }, 'Language easy'),
    h('p', { class: 'muted' }, 'Euer Sprachtrainer für Italienisch, Japanisch, Französisch, Englisch und Deutsch.'),
    h('label', { for: 'server' }, 'Backend-Adresse'), server,
    h('label', { for: 'pw' }, 'Passwort'), pw,
    err, btn
  );
  const figs = h('div', { class: 'login-figs' }, ['it', 'fr', 'de'].map(l => {
    const a = new Avatar(l, { small: true });
    return a.el;
  }));
  clear(main).append(h('section', { class: 'login-wrap' }, figs, form));
  stagger(main);
}

/* Profilauswahl */
async function viewProfiles() {
  setWorld(null); app.profile = null; renderNav();
  clear(main).append(loader('Lade Profile'));
  app.profiles = await api.get('/api/profiles');
  const list = h('div', { class: 'profiles' },
    app.profiles.map(p => spotlight(h('button', { class: 'tile profile-tile reveal', onclick: () => { store('profile', p.id); go('home'); } },
      h('span', { class: 'avatar-dot', 'data-lang': (p.languages || ['it'])[0] }, p.name.slice(0, 1).toUpperCase()),
      h('strong', {}, p.name),
      h('span', { class: 'muted' }, (p.languages || []).map(l => LANGS[l].name).join(', '))
    ))),
    h('button', { class: 'tile add-tile reveal', onclick: () => go('new-profile') }, h('span', { class: 'plus' }, '+'), h('strong', {}, 'Profil anlegen'))
  );
  clear(main).append(h('section', {}, h('h1', { class: 'title' }, 'Wer lernt gerade?'), list));
  stagger(main);
}

function profileForm(existing) {
  const name = h('input', { value: existing ? existing.name : '', placeholder: 'Name', required: true, id: 'pname', maxlength: 40 });
  const kind = h('select', { id: 'pkind' },
    h('option', { value: 'adult' }, 'Erwachsen'),
    h('option', { value: 'teen' }, 'Jugendlich (14 Jahre)'));
  kind.value = existing ? existing.kind : 'adult';
  const interests = h('textarea', { id: 'pint', rows: 3, placeholder: 'Zum Beispiel: Matcha, Eis, Pizza, Pferde, Harry Potter' }, existing ? existing.interests : '');
  const chosen = new Set(existing ? existing.languages : ['it', 'ja', 'fr', 'en']);
  const langBox = h('div', { class: 'checks' }, Object.keys(LANGS).map(l => {
    const cb = h('input', { type: 'checkbox', value: l, id: 'cb-' + l });
    cb.checked = chosen.has(l);
    return h('label', { class: 'check', for: 'cb-' + l }, cb, LANGS[l].name);
  }));
  const fields = h('div', { class: 'form' },
    h('label', { for: 'pname' }, 'Name'), name,
    h('label', { for: 'pkind' }, 'Alter'), kind,
    h('label', { for: 'pint' }, 'Interessen (damit Lektionen und Tipps passen)'), interests,
    h('span', { class: 'label' }, 'Sprachen'), langBox);
  const read = () => ({
    name: name.value.trim(), kind: kind.value, interests: interests.value.trim(),
    languages: Array.from(langBox.querySelectorAll('input:checked')).map(i => i.value)
  });
  kind.addEventListener('change', () => {
    if (!existing && kind.value === 'teen') langBox.querySelector('#cb-de').checked = true;
  });
  return { fields, read };
}

function viewNewProfile() {
  setWorld(null); renderNav();
  const { fields, read } = profileForm(null);
  const btn = h('button', { class: 'btn primary', type: 'submit' }, 'Profil anlegen');
  const form = h('form', { class: 'card', onsubmit: async (e) => {
    e.preventDefault();
    const data = read();
    if (!data.name) return toast('Bitte einen Namen eintragen', 'error');
    if (!data.languages.length) return toast('Wähle mindestens eine Sprache', 'error');
    btn.disabled = true;
    try { const p = await api.post('/api/profiles', data); store('profile', p.id); go('home'); }
    catch (err) { toast(err.message, 'error'); btn.disabled = false; }
  } }, h('h1', { class: 'title' }, 'Neues Profil'), fields, btn);
  clear(main).append(form);
}

async function loadProfile() {
  const id = store('profile');
  if (!id) { go('profiles'); return null; }
  try {
    app.overview = await api.get(`/api/profiles/${id}/overview`);
  } catch (e) {
    if (e instanceof AuthError) throw e;
    store('profile', null); go('profiles'); return null;
  }
  app.profile = app.overview.profile;
  return app.overview;
}

/* Startseite mit Tagesplan */
async function viewHome() {
  setWorld(null);
  clear(main).append(loader('Lade deinen Tag'));
  const ov = await loadProfile();
  if (!ov) return;
  renderNav('home');
  const hour = new Date().getHours();
  const greet = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Hallo' : 'Guten Abend';
  const total = ov.langs.reduce((s, l) => s + l.todaySeconds, 0);
  const totalEl = h('span', { class: 'big-num' }, '0');
  const streakEl = h('span', { class: 'big-num' }, '0');
  const head = h('header', { class: 'home-head reveal' },
    h('h1', { class: 'title' }, `${greet}, ${app.profile.name}`),
    h('div', { class: 'stats' },
      h('div', { class: 'stat' }, totalEl, h('span', {}, 'Minuten heute')),
      h('div', { class: 'stat' }, streakEl, h('span', {}, ov.streak === 1 ? 'Tag am Stück' : 'Tage am Stück'))
    ));
  const byLang = Object.fromEntries(ov.langs.map(l => [l.lang, l]));
  const blocks = BLOCKS.map(b => {
    const langs = b.langs.filter(l => byLang[l]);
    if (!langs.length) return null;
    return h('section', { class: 'block reveal' },
      h('h2', {}, b.name),
      h('div', { class: 'tiles' }, langs.map(l => langTile(byLang[l]))));
  });
  const tipWrap = h('div', { class: 'home-daily' });
  clear(main).append(head, ...blocks.filter(Boolean), tipWrap);
  countUp(totalEl, minutes(total));
  countUp(streakEl, ov.streak);
  stagger(main);
  const firstLang = (app.profile.languages || []).find(l => l !== 'de') || app.profile.languages[0];
  if (firstLang) tipWrap.append(dailyCard(app.profile, firstLang, 'tip', byLang[firstLang]));
}

function langTile(s) {
  const m = LANGS[s.lang];
  const goal = 20;
  const mins = minutes(s.todaySeconds);
  const pct = Math.min(100, Math.round((mins / goal) * 100));
  const num = h('span', { class: 'tile-min' }, '0');
  const tile = spotlight(h('a', { class: 'tile lang-tile', href: '#/learn/' + s.lang, 'data-lang': s.lang, style: { '--w1': m.color, '--w2': m.color2 } },
    h('img', { class: 'tile-fig', src: m.clips ? `avatars/${s.lang}/poster.jpg` : '', alt: '', hidden: !m.clips }),
    !m.clips ? h('span', { class: 'tile-fig placeholder', html: figureSvg(s.lang) }) : null,
    h('div', { class: 'tile-text' },
      h('strong', {}, m.name),
      h('span', { class: 'muted' }, s.lang === 'de' ? 'Rechtschreibung und Schreiben' : `Heute in ${s.place}, Niveau ${s.level}`),
      h('span', { class: 'tile-row' }, num, h('span', { class: 'muted' }, ` von ${goal} Minuten`),
        s.dueCards ? h('span', { class: 'badge' }, `${s.dueCards} zum Wiederholen`) : null)),
    h('span', { class: 'ring', style: { '--p': pct }, title: pct + ' Prozent vom Tagesziel' })));
  countUp(num, mins);
  return tile;
}

/* Lernwelt einer Sprache */
const MODES = {
  default: [['lesson', 'Lektion'], ['chat', 'Gespräch'], ['review', 'Wiederholen'], ['listen', 'Hören'], ['daily', 'Tipp und Gedicht']],
  de: [['diktat', 'Diktat'], ['schreiben', 'Schreibwerkstatt'], ['kartei', 'Fehlerkartei'], ['gedicht', 'Gedichte']]
};

async function viewLearn(lang, mode) {
  if (!LANGS[lang]) return go('home');
  if (!app.overview || !app.profile) { const ov = await loadProfile(); if (!ov) return; }
  else app.overview = await api.get(`/api/profiles/${app.profile.id}/overview`).catch(() => app.overview);
  if (!(app.profile.languages || []).includes(lang)) return go('home');
  setWorld(lang);
  renderNav(lang);
  const st = app.overview.langs.find(l => l.lang === lang) || { level: 'A0', place: '' };
  const modes = MODES[lang] || MODES.default;
  if (!mode || !modes.find(m => m[0] === mode)) mode = modes[0][0];
  const avatar = new Avatar(lang);
  const m = LANGS[lang];
  const tabs = h('nav', { class: 'modes', 'aria-label': 'Übungsart' }, modes.map(([key, label]) =>
    h('a', { class: 'pill' + (key === mode ? ' active' : ''), href: `#/learn/${lang}/${key}` }, label)));
  const levelSel = lang === 'de' ? null : h('select', { class: 'level-select', 'aria-label': 'Niveau', onchange: async (e) => {
    try { await api.patch(`/api/state/${app.profile.id}/${lang}`, { level: e.target.value }); toast('Niveau gespeichert'); }
    catch (err) { toast(err.message, 'error'); }
  } }, ['A0', 'A1', 'A2', 'B1', 'B2', 'C1'].map(l => h('option', { value: l, selected: l === st.level }, l)));
  const head = h('header', { class: 'world-head' },
    h('div', { class: 'world-title' },
      h('h1', { class: 'title shiny' }, m.name),
      h('p', { class: 'muted' }, lang === 'de' ? `Mit ${m.figure} an Rechtschreibung und Texten feilen` : `Mit ${m.figure} in ${st.place}`),
      levelSel ? h('label', { class: 'level' }, 'Niveau ', levelSel) : null),
    avatar.el);
  const body = h('div', { class: 'mode-body' });
  clear(main).append(h('section', { class: 'world' }, head, tabs, body));
  session.start(lang);
  const ctx = { lang, profile: app.profile, avatar, body, state: st, app, onBreakCheck: breakCheck };
  const r = {
    lesson: renderLesson, chat: renderChat, review: renderReview, listen: renderListen, daily: renderDaily,
    diktat: renderGerman, schreiben: renderGerman, kartei: renderGerman, gedicht: renderGerman
  }[mode];
  ctx.mode = mode;
  const cleanup = await r(ctx);
  app.cleanup = () => { if (typeof cleanup === 'function') cleanup(); session.flush(); };
}

/* Pausenvorschlag nach langer Zeit oder vielen Fehlern */
let breakShownFor = '';
function breakCheck(ctx, { errorsInRow = 0 } = {}) {
  const st = app.overview.langs.find(l => l.lang === ctx.lang);
  const secs = (st ? st.todaySeconds : 0) + session.seconds;
  const key = ctx.lang + new Date().toDateString();
  if ((secs > 30 * 60 || errorsInRow >= 4) && breakShownFor !== key) {
    breakShownFor = key;
    const box = h('div', { class: 'break-note card' },
      h('p', {}, errorsInRow >= 4
        ? `${LANGS[ctx.lang].figure} merkt: Die Konzentration lässt nach. Kurz durchatmen, etwas trinken, oder entspannt weiter mit Hören?`
        : 'Schon über eine halbe Stunde dabei. Eine kleine Pause hilft dem Gehirn, alles abzuspeichern.'),
      h('div', { class: 'row' },
        h('a', { class: 'btn', href: `#/learn/${ctx.lang}/listen` }, 'Weiter mit Hören'),
        h('button', { class: 'btn ghost', onclick: () => box.remove() }, 'Weitermachen')));
    ctx.body.prepend(box);
  }
}

/* Einstellungen */
async function viewSettings() {
  if (!app.profile) { const ov = await loadProfile(); if (!ov) return; }
  setWorld(null); renderNav('settings');
  const { fields, read } = profileForm(app.profile);
  const save = h('button', { class: 'btn primary', type: 'submit' }, 'Profil speichern');
  const form = h('form', { class: 'card', onsubmit: async (e) => {
    e.preventDefault();
    try { app.profile = await api.patch('/api/profiles/' + app.profile.id, read()); toast('Profil gespeichert'); }
    catch (err) { toast(err.message, 'error'); }
  } }, h('h2', {}, 'Profil'), fields, save);
  const voices = h('div', { class: 'card' }, h('h2', {}, 'Stimmen der Figuren'), loader('Lade Stimmen'));
  const actions = h('div', { class: 'card' }, h('h2', {}, 'Konto'),
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => { store('profile', null); go('profiles'); } }, 'Profil wechseln'),
      h('button', { class: 'btn ghost', onclick: () => { store('token', null); store('profile', null); go('login'); } }, 'Abmelden')));
  clear(main).append(h('section', { class: 'settings' }, h('h1', { class: 'title' }, 'Einstellungen'), form, voices, actions));
  try {
    const { voices: list, current } = await api.get('/api/voices');
    clear(voices).append(h('h2', {}, 'Stimmen der Figuren'));
    if (!list.length) { voices.append(h('p', { class: 'muted' }, 'Keine Stimmen gefunden. Prüfe den ElevenLabs-Schlüssel in Railway.')); return; }
    voices.append(h('p', { class: 'muted' }, 'Jede Figur kann ihre eigene Stimme bekommen. Alle Stimmen sprechen jede Sprache.'));
    for (const l of Object.keys(LANGS)) {
      const sel = h('select', { 'aria-label': 'Stimme für ' + LANGS[l].name }, list.map(v =>
        h('option', { value: v.id, selected: v.id === current[l] }, `${v.name}${v.labels.gender ? ' (' + v.labels.gender + ')' : ''}`)));
      if (!list.find(v => v.id === current[l])) sel.prepend(h('option', { value: current[l], selected: true }, 'Standardstimme'));
      const play = h('button', { class: 'btn small', type: 'button', onclick: () => {
        const v = list.find(x => x.id === sel.value);
        if (v && v.preview) new Audio(v.preview).play();
      } }, 'Anhören');
      sel.addEventListener('change', async () => {
        try { await api.put('/api/voices/' + l, { voiceId: sel.value }); toast(`Stimme für ${LANGS[l].figure} gespeichert`); }
        catch (err) { toast(err.message, 'error'); }
      });
      voices.append(h('div', { class: 'voice-row' }, h('strong', {}, `${LANGS[l].figure} (${LANGS[l].name})`), sel, play));
    }
  } catch (e) { clear(voices).append(h('h2', {}, 'Stimmen der Figuren'), h('p', { class: 'error' }, e.message)); }
}

/* Router */
async function route() {
  teardown();
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [page, a, b] = parts;
  if (!apiBase() || !token()) { if (page !== 'login') return go('login'); return viewLogin(); }
  try {
    if (page === 'login') return viewLogin();
    if (page === 'profiles' || !page) {
      if (!page && store('profile')) return go('home');
      return await viewProfiles();
    }
    if (page === 'new-profile') return viewNewProfile();
    if (page === 'home') return await viewHome();
    if (page === 'learn') return await viewLearn(a, b);
    if (page === 'settings') return await viewSettings();
    go('home');
  } catch (e) {
    if (e instanceof AuthError) return viewLogin(e.message);
    clear(main).append(h('div', { class: 'card error-card' },
      h('h2', {}, 'Da hat etwas nicht geklappt'), h('p', {}, e.message),
      h('button', { class: 'btn', onclick: route }, 'Nochmal versuchen')));
  }
}

addEventListener('hashchange', route);
initClickSpark();
route();
