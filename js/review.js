import { h, clear, toast, loader, compareSpeech, LANGS } from './util.js';
import { api } from './api.js';
import { say, stopSpeaking, Recorder, transcribe } from './audio.js';

export async function renderReview(ctx) {
  const { body, profile, lang, avatar } = ctx;
  const rec = new Recorder();
  let alive = true;
  clear(body).append(loader('Suche fällige Karten'));
  let queue = [];
  try { queue = await api.get(`/api/review?profileId=${profile.id}&lang=${lang}`); }
  catch (e) { clear(body).append(h('p', { class: 'error' }, e.message)); return; }
  let done = 0;
  const total = queue.length;
  const card = h('div', { class: 'card review-card' });
  const progress = h('div', { class: 'progress' }, h('span', { style: { width: '0%' } }));
  clear(body).append(progress, card);

  function next() {
    stopSpeaking();
    progress.firstChild.style.width = (total ? Math.round((done / total) * 100) : 0) + '%';
    if (!queue.length) {
      clear(card).append(h('div', { class: 'center-col' },
        h('h2', {}, total ? 'Alles wiederholt!' : 'Heute ist nichts fällig'),
        h('p', { class: 'muted' }, total
          ? 'Was du gewusst hast, kommt erst in ein paar Tagen wieder. So wandert es ins Langzeitgedächtnis.'
          : 'Neue Karten entstehen, wenn du Lektionen abschließt oder im Gespräch Fehler machst.'),
        h('a', { class: 'btn primary', href: `#/learn/${lang}/lesson` }, 'Zur Lektion')));
      if (total) avatar.set('happy');
      return;
    }
    const c = queue[0];
    const isError = c.kind === 'error';
    const answer = h('div', { class: 'answer', hidden: true },
      h('p', { class: 'target', lang }, c.back),
      c.extra && c.extra.roman ? h('p', { class: 'roman' }, c.extra.roman) : null,
      c.extra && c.extra.rule ? h('p', { class: 'rule' }, c.extra.rule) : null);
    const result = h('div', { class: 'result' });
    const mic = h('button', { class: 'mic small', 'aria-label': 'Antwort sprechen', onclick: async () => {
      if (rec.active) {
        mic.classList.remove('rec'); avatar.set('think');
        const blob = await rec.stop();
        if (!blob) { avatar.set('idle'); return; }
        clear(result).append(loader('Höre zu'));
        try {
          const said = await transcribe(blob, lang, c.back);
          const cmp = compareSpeech(c.back, said, lang);
          clear(result).append(h('p', {}, 'Verstanden: ' + (said || '(nichts)')), h('p', { class: 'score' }, cmp.score + ' Prozent getroffen'));
          reveal();
          avatar.set(cmp.score >= 80 ? 'happy' : 'idle');
        } catch (e) { clear(result).append(h('p', { class: 'error' }, e.message)); avatar.set('idle'); }
      } else {
        try { await rec.start(); mic.classList.add('rec'); avatar.set('listen'); }
        catch (e) { toast('Mikrofon nicht verfügbar', 'error'); }
      }
    } }, h('span', { class: 'mic-dot' }));
    const grade = h('div', { class: 'row center', hidden: true },
      h('button', { class: 'btn', onclick: () => rate(false) }, 'Nochmal üben'),
      h('button', { class: 'btn primary', onclick: () => rate(true) }, 'Gewusst'));
    const showBtn = h('button', { class: 'btn', onclick: reveal }, 'Lösung zeigen');
    function reveal() {
      answer.hidden = false; grade.hidden = false; showBtn.hidden = true;
      say(c.back, lang, { onStart: () => avatar.set('talk'), onEnd: () => avatar.set('idle') });
    }
    async function rate(known) {
      grade.querySelectorAll('button').forEach(b => b.disabled = true);
      try { await api.post('/api/review/' + c.id, { known }); } catch (e) { toast(e.message, 'error'); }
      queue.shift();
      if (!known) queue.splice(Math.min(3, queue.length), 0, { ...c });
      else done++;
      if (alive) next();
    }
    clear(card).append(
      h('p', { class: 'muted' }, isError ? 'So hast du es mal gesagt. Wie heißt es richtig?' : `Wie sagst du das auf ${LANGS[lang].name}?`),
      h('p', { class: 'front' + (isError ? ' wrong' : ''), lang: isError ? lang : 'de' }, c.front),
      h('div', { class: 'row center' }, mic, showBtn),
      result, answer, grade);
  }
  next();
  return () => { alive = false; stopSpeaking(); if (rec.active) rec.stop(); };
}
