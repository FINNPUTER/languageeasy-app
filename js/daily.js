import { h, clear, loader, LANGS } from './util.js';
import { api } from './api.js';
import { say, stopSpeaking } from './audio.js';
import { interlinear } from './lines.js';

function contentView(data, lang, kind, avatar) {
  const lines = (data.lines || []).filter(l => l.text);
  const isDe = lang === 'de';
  const els = lines.map(l => isDe
    ? h('p', { class: 'poem-line', lang: 'de' }, l.text)
    : interlinear(l, lang, { decode: true, translation: false, speaker: false }));
  const playAll = async () => {
    for (const l of lines) {
      await say(l.text, lang, { onStart: () => avatar && avatar.set('talk'), onEnd: () => avatar && avatar.set('idle') });
    }
  };
  const head = kind === 'poem'
    ? [h('h3', { lang }, data.title || ''), h('p', { class: 'muted' }, [data.author, data.year].filter(Boolean).join(', ')),
      data.intro_de ? h('p', {}, data.intro_de) : null]
    : [h('h3', {}, data.headline_de || data.name || 'Tipp des Tages'),
      h('p', { class: 'muted' }, [data.category, data.name, data.where].filter(Boolean).join(', '))];
  return h('div', { class: 'daily-content' }, ...head,
    h('div', { class: 'lines' + (kind === 'poem' ? ' poem' : '') }, ...els),
    h('div', { class: 'row' },
      h('button', { class: 'btn small', onclick: playAll }, 'Vorlesen'),
      !isDe ? h('button', { class: 'btn small ghost', onclick: (e) => {
        e.currentTarget.closest('.daily-content').querySelectorAll('.de').forEach(d => d.classList.toggle('hidden-de'));
      } }, 'Übersetzung') : null));
}

export function dailyCard(profile, lang, kind, state, avatar) {
  const m = LANGS[lang];
  const label = kind === 'poem' ? 'Gedicht der Woche' : 'Tipp des Tages';
  const card = h('section', { class: 'card daily reveal', 'data-lang': lang, style: { '--w1': m.color, '--w2': m.color2 } },
    h('h2', {}, `${label} von ${m.figure}`), loader(kind === 'poem' ? 'Suche ein schönes Gedicht' : 'Sucht einen schönen Ort'));
  api.get(`/api/daily?profileId=${profile.id}&lang=${lang}&kind=${kind}`)
    .then(data => { card.lastChild.remove(); card.append(contentView(data, lang, kind, avatar)); })
    .catch(e => { card.lastChild.remove(); card.append(h('p', { class: 'error' }, e.message)); });
  return card;
}

export async function renderDaily(ctx) {
  const { body, profile, lang, avatar } = ctx;
  clear(body).append(
    dailyCard(profile, lang, 'tip', ctx.state, avatar),
    dailyCard(profile, lang, 'poem', ctx.state, avatar));
  return () => stopSpeaking();
}
