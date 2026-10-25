import { h, clear, loader, LANGS } from './util.js';
import { api } from './api.js';
import { say, stopSpeaking } from './audio.js';

export async function renderListen(ctx) {
  const { body, profile, lang, avatar } = ctx;
  let alive = true;
  let playing = false;
  let wakeLock = null;
  clear(body).append(loader('Lade deine Lektionen'));
  let lessons = [];
  try { lessons = await api.get(`/api/lessons?profileId=${profile.id}&lang=${lang}`); }
  catch (e) { clear(body).append(h('p', { class: 'error' }, e.message)); return; }
  if (!lessons.length) {
    clear(body).append(h('div', { class: 'card center-col' },
      h('p', {}, 'Hier läuft später alles, was du schon gelernt hast, zum Mithören unterwegs. Mach zuerst eine Lektion.'),
      h('a', { class: 'btn primary', href: `#/learn/${lang}/lesson` }, 'Zur Lektion')));
    return;
  }
  const withDe = h('input', { type: 'checkbox', id: 'withde' });
  const slow = h('input', { type: 'checkbox', id: 'slow' });
  const now = h('div', { class: 'now-playing' }, h('p', { class: 'muted' }, 'Bereit.'));
  const chosen = new Set(lessons.filter(l => l.completed_at).slice(0, 8).map(l => l.id));
  if (!chosen.size) chosen.add(lessons[0].id);
  const list = h('ul', { class: 'lesson-list' }, lessons.map(l => {
    const cb = h('input', { type: 'checkbox', checked: chosen.has(l.id) });
    cb.checked = chosen.has(l.id);
    cb.addEventListener('change', () => cb.checked ? chosen.add(l.id) : chosen.delete(l.id));
    return h('li', {}, h('label', { class: 'check' }, cb, h('span', {}, l.title), h('span', { class: 'muted' }, l.content.title_de || '')));
  }));
  const playBtn = h('button', { class: 'btn primary big', onclick: () => playing ? stop() : start() }, 'Alles abspielen');

  clear(body).append(
    h('div', { class: 'card' },
      h('p', {}, 'Das Hören nebenbei wirkt am besten mit Lektionen, die du schon verstehst. Ideal beim Kochen, Spazierengehen oder im Auto.'),
      h('div', { class: 'row' },
        h('label', { class: 'check', for: 'withde' }, withDe, 'Mit deutscher Übersetzung'),
        h('label', { class: 'check', for: 'slow' }, slow, 'Etwas langsamer')),
      playBtn, now),
    h('div', { class: 'card' }, h('h2', {}, 'Was soll laufen?'), list));

  async function start() {
    playing = true;
    playBtn.textContent = 'Stoppen';
    try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
    const picked = lessons.filter(l => chosen.has(l.id)).reverse();
    outer: for (let round = 0; round < 3; round++) {
      for (const l of picked) {
        for (const line of (l.content.lines || [])) {
          if (!playing || !alive) break outer;
          clear(now).append(h('p', { class: 'target', lang }, line.text), withDe.checked ? h('p', { class: 'muted' }, line.de) : null,
            h('p', { class: 'muted small' }, `${l.title}, Runde ${round + 1} von 3`));
          if ('mediaSession' in navigator) {
            try { navigator.mediaSession.metadata = new MediaMetadata({ title: line.text, artist: LANGS[lang].figure, album: l.title }); } catch (e) {}
          }
          await say(line.text, lang, { rate: slow.checked ? 0.8 : 1, onStart: () => avatar.set('talk'), onEnd: () => avatar.set('idle') });
          if (!playing || !alive) break outer;
          if (withDe.checked && line.de) await say(line.de, 'de', { rate: 1.05 });
          await new Promise(r => setTimeout(r, 700));
        }
      }
    }
    stop();
  }

  function stop() {
    playing = false;
    stopSpeaking();
    playBtn.textContent = 'Alles abspielen';
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
    avatar.set('idle');
  }

  return () => { alive = false; stop(); };
}
