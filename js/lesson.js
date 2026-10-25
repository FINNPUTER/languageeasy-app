import { h, clear, toast, loader, compareSpeech, LANGS } from './util.js';
import { api } from './api.js';
import { say, stopSpeaking, preload, Recorder, transcribe } from './audio.js';
import { interlinear } from './lines.js';

const STEPS = [
  ['listen', 'Einhören'],
  ['decode', 'Dekodieren'],
  ['active', 'Aktiv hören'],
  ['shadow', 'Nachsprechen']
];

export async function renderLesson(ctx) {
  const { body, profile, lang, avatar } = ctx;
  let alive = true;
  const rec = new Recorder();

  async function showList() {
    clear(body).append(loader('Lade Lektionen'));
    let lessons = [];
    try { lessons = await api.get(`/api/lessons?profileId=${profile.id}&lang=${lang}`); }
    catch (e) { clear(body).append(h('p', { class: 'error' }, e.message)); return; }
    if (!alive) return;
    const open = lessons.find(l => !l.completed_at);
    const newBtn = h('button', { class: 'btn primary big', onclick: () => create(newBtn) },
      lessons.length ? 'Neue Lektion erstellen' : 'Erste Lektion starten');
    const intro = h('div', { class: 'card intro' },
      h('p', {}, `${LANGS[lang].figure} erzählt dir eine kleine Geschichte. Erst hörst du nur zu, dann entschlüsselst du sie Wort für Wort, hörst aktiv mit und sprichst am Ende nach.`),
      h('div', { class: 'row' },
        open ? h('button', { class: 'btn primary big', onclick: () => openLesson(open) }, 'Weitermachen: ' + open.title) : null,
        newBtn));
    const list = lessons.length ? h('div', { class: 'card' }, h('h2', {}, 'Deine Lektionen'),
      h('ul', { class: 'lesson-list' }, lessons.slice(0, 20).map(l => h('li', {},
        h('button', { class: 'linkish', onclick: () => openLesson(l) },
          h('span', {}, l.title), h('span', { class: 'muted' }, l.content.title_de || ''),
          h('span', { class: 'tag' + (l.completed_at ? ' done' : '') }, l.completed_at ? 'geschafft' : l.level)))))) : null;
    clear(body).append(intro, list);
  }

  async function create(btn) {
    btn.disabled = true;
    avatar.set('think');
    clear(body).append(loader(`${LANGS[lang].figure} schreibt deine Lektion`));
    try {
      const l = await api.post('/api/lessons', { profileId: profile.id, lang });
      if (alive) openLesson(l);
    } catch (e) {
      toast(e.message, 'error');
      if (alive) showList();
    } finally { avatar.set('idle'); }
  }

  function openLesson(lesson) {
    const c = lesson.content;
    const lines = (c.lines || []).filter(l => l.text);
    preload(lines.map(l => l.text), lang);
    let step = 0;
    let rate = 1;
    let playId = 0;
    const stepBar = h('ol', { class: 'steps' });
    const stage = h('div', { class: 'lesson-stage' });
    const wrap = h('div', { class: 'lesson' },
      h('div', { class: 'lesson-head' },
        h('button', { class: 'btn ghost small', onclick: () => { stopSpeaking(); showList(); } }, 'Zur Übersicht'),
        h('h2', {}, c.title), h('p', { class: 'muted' }, c.title_de || ''), c.scene ? h('p', { class: 'scene' }, c.scene) : null),
      stepBar, stage);
    clear(body).append(wrap);

    function drawSteps() {
      clear(stepBar).append(...STEPS.map(([, label], i) => h('li', { class: i === step ? 'now' : i < step ? 'done' : '' },
        h('button', { onclick: () => { stopSpeaking(); step = i; draw(); } }, label))));
    }

    async function playAll(onLine, from = 0) {
      const id = ++playId;
      for (let i = from; i < lines.length; i++) {
        if (!alive || id !== playId) break;
        onLine && onLine(i);
        await say(lines[i].text, lang, { rate, onStart: () => avatar.set('talk'), onEnd: () => avatar.set('idle') });
        await new Promise(r => setTimeout(r, 350));
      }
      if (id === playId) onLine && onLine(-1);
    }

    function nextBtn(label) {
      return h('button', { class: 'btn primary', onclick: () => { stopSpeaking(); step++; draw(); } }, label);
    }

    function draw() {
      drawSteps();
      playId++;
      clear(stage);
      const key = STEPS[step] ? STEPS[step][0] : 'finish';
      if (key === 'listen') {
        const status = h('p', { class: 'muted center' }, 'Noch nichts lesen. Einfach zuhören und die Melodie der Sprache aufnehmen.');
        const play = h('button', { class: 'play-big', 'aria-label': 'Geschichte anhören', onclick: async () => {
          play.disabled = true; status.textContent = 'Hör einfach zu …';
          await playAll(i => { if (i >= 0) status.textContent = `Satz ${i + 1} von ${lines.length}`; });
          play.disabled = false; status.textContent = 'Gerne noch ein zweites Mal. Je öfter, desto besser.';
        } }, '▶');
        stage.append(h('div', { class: 'card center-col' }, play, status, nextBtn('Weiter zum Dekodieren')));
      }
      if (key === 'decode') {
        const box = h('div', { class: 'card lines' },
          h('p', { class: 'muted' }, 'Unter jedem Wort steht, was es wörtlich bedeutet. Tippe auf eine Zeile, um sie zu hören.'),
          ...lines.map(l => {
            const el = interlinear(l, lang, { decode: true, translation: false });
            el.classList.add('tap');
            el.addEventListener('click', () => {
              el.querySelector('.de') && el.querySelector('.de').classList.remove('hidden-de');
              say(l.text, lang, { rate, onStart: () => avatar.set('talk'), onEnd: () => avatar.set('idle') });
            });
            return el;
          }));
        stage.append(box, h('div', { class: 'row' },
          h('button', { class: 'btn', onclick: () => box.querySelectorAll('.de').forEach(d => d.classList.toggle('hidden-de')) }, 'Übersetzungen zeigen'),
          nextBtn('Weiter zum aktiven Hören')));
      }
      if (key === 'active') {
        let decode = true;
        const els = lines.map(l => interlinear(l, lang, { decode: true }));
        const box = h('div', { class: 'card lines' }, ...els);
        const speedBtn = h('button', { class: 'btn small', onclick: () => {
          rate = rate === 1 ? 0.75 : 1; speedBtn.textContent = rate === 1 ? 'Langsamer' : 'Normales Tempo';
        } }, rate === 1 ? 'Langsamer' : 'Normales Tempo');
        const decBtn = h('button', { class: 'btn small', onclick: () => {
          decode = !decode; els.forEach(e => e.querySelector('.il').classList.toggle('no-decode', !decode));
          decBtn.textContent = decode ? 'Hilfszeile ausblenden' : 'Hilfszeile zeigen';
        } }, 'Hilfszeile ausblenden');
        const play = h('button', { class: 'btn primary', onclick: async () => {
          play.disabled = true;
          await playAll(i => els.forEach((e, k) => e.classList.toggle('playing', k === i)));
          play.disabled = false;
        } }, 'Abspielen und mitlesen');
        stage.append(h('div', { class: 'row' }, play, speedBtn, decBtn),
          h('p', { class: 'muted' }, 'Hör so oft mit, bis du ohne Hilfszeile alles verstehst. Dann geht es weiter.'),
          box, nextBtn('Weiter zum Nachsprechen'));
      }
      if (key === 'shadow') {
        let i = 0;
        const card = h('div', { class: 'card shadow-card' });
        const drawLine = () => {
          const l = lines[i];
          const result = h('div', { class: 'result' });
          const mic = h('button', { class: 'mic', 'aria-label': 'Aufnahme starten', onclick: async () => {
            if (rec.active) {
              mic.classList.remove('rec'); mic.setAttribute('aria-label', 'Aufnahme starten');
              avatar.set('think');
              const blob = await rec.stop();
              if (!blob) { avatar.set('idle'); return; }
              clear(result).append(loader('Höre genau hin'));
              try {
                const said = await transcribe(blob, lang, l.text);
                const cmp = compareSpeech(l.text, said, lang);
                clear(result).append(
                  h('p', { class: 'cmp' }, cmp.words.map(w => h('span', { class: w.ok ? 'ok' : 'miss' }, w.w + ' '))),
                  h('p', { class: 'muted' }, 'Verstanden: ' + (said || '(nichts)')),
                  h('p', { class: 'score' }, cmp.score >= 85 ? `Super, ${cmp.score} Prozent!` : cmp.score >= 60 ? `Gut, ${cmp.score} Prozent. Die roten Wörter nochmal.` : `${cmp.score} Prozent. Hör dir den Satz nochmal an und probier es langsam.`));
                avatar.set(cmp.score >= 85 ? 'happy' : 'idle');
              } catch (e) { clear(result).append(h('p', { class: 'error' }, e.message)); avatar.set('idle'); }
            } else {
              stopSpeaking();
              try { await rec.start(); mic.classList.add('rec'); mic.setAttribute('aria-label', 'Aufnahme beenden'); avatar.set('listen'); }
              catch (e) { toast('Mikrofon nicht verfügbar: ' + e.message, 'error'); }
            }
          } }, h('span', { class: 'mic-dot' }));
          clear(card).append(
            h('p', { class: 'muted' }, `Satz ${i + 1} von ${lines.length}: anhören, dann aufs Mikrofon tippen, nachsprechen und nochmal tippen.`),
            interlinear(l, lang, { decode: true, translation: true }),
            h('div', { class: 'row center' },
              h('button', { class: 'btn', onclick: () => say(l.text, lang, { rate, onStart: () => avatar.set('talk'), onEnd: () => avatar.set('idle') }) }, 'Anhören'),
              h('button', { class: 'btn', onclick: () => say(l.text, lang, { rate: 0.7, onStart: () => avatar.set('talk'), onEnd: () => avatar.set('idle') }) }, 'Ganz langsam'),
              mic),
            result,
            h('div', { class: 'row' },
              i > 0 ? h('button', { class: 'btn ghost', onclick: () => { i--; drawLine(); } }, 'Zurück') : null,
              i < lines.length - 1
                ? h('button', { class: 'btn primary', onclick: () => { i++; drawLine(); } }, 'Nächster Satz')
                : h('button', { class: 'btn primary', onclick: () => { step++; draw(); } }, 'Lektion abschließen')));
        };
        drawLine();
        stage.append(card);
      }
      if (key === 'finish') {
        const vocab = (c.vocab || []).filter(v => v.word);
        stage.append(h('div', { class: 'card center-col' },
          h('h2', {}, 'Geschafft!'),
          h('p', {}, 'Die Sätze dieser Lektion kommen ab morgen in deine Wiederholung, nach 1, 3, 7 und 21 Tagen.'),
          vocab.length ? h('ul', { class: 'vocab' }, vocab.map(v => h('li', {},
            h('button', { class: 'linkish', onclick: () => say(v.word, lang) }, v.word),
            v.roman ? h('span', { class: 'roman' }, v.roman) : null,
            h('span', { class: 'muted' }, v.de)))) : null,
          h('div', { class: 'row center' },
            h('button', { class: 'btn primary', onclick: showList }, 'Zur Übersicht'),
            h('a', { class: 'btn', href: `#/learn/${lang}/chat` }, 'Jetzt darüber reden'))));
        avatar.set('happy');
        api.post(`/api/lessons/${lesson.id}/complete`).catch(e => toast(e.message, 'error'));
      }
    }
    draw();
  }

  await showList();
  return () => { alive = false; stopSpeaking(); if (rec.active) rec.stop(); };
}
