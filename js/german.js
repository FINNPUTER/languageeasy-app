import { h, clear, toast, loader, charDiff, store } from './util.js';
import { api } from './api.js';
import { say, stopSpeaking } from './audio.js';
import { dailyCard } from './daily.js';

function talk(avatar, text, rate = 1) {
  return say(text, 'de', { rate, onStart: () => avatar.set('talk'), onEnd: () => avatar.set('idle') });
}

function errorList(errors) {
  if (!errors || !errors.length) return null;
  return h('ul', { class: 'errors' }, errors.map(e => h('li', {},
    h('span', { class: 'wrong' }, e.wrong), ' wird zu ', h('strong', { class: 'right' }, e.right),
    e.rule ? h('p', { class: 'rule' }, e.rule) : null)));
}

function diffView(expected, typed) {
  return h('p', { class: 'diff' }, charDiff(expected, typed).map(d =>
    d.t === 'same' ? d.c : h('span', { class: d.t }, d.c === ' ' ? ' ' : d.c)));
}

async function diktat(ctx) {
  const { body, profile, avatar } = ctx;
  clear(body).append(h('div', { class: 'card center-col' },
    h('p', {}, 'Brezel liest dir sechs Sätze vor. Du schreibst sie auf, dann schauen wir gemeinsam, wo es noch hakt. Jeder Fehler landet in deiner Fehlerkartei.'),
    h('button', { class: 'btn primary big', onclick: start }, 'Diktat starten')));

  async function start() {
    avatar.set('think');
    clear(body).append(loader('Brezel überlegt sich ein Diktat'));
    let d;
    try { d = await api.post('/api/de/diktat', { profileId: profile.id }); }
    catch (e) { toast(e.message, 'error'); avatar.set('idle'); return diktat(ctx); }
    avatar.set('idle');
    const sentences = (d.sentences || []).filter(s => s.text);
    let i = 0, mistakes = 0;
    const card = h('div', { class: 'card' });
    clear(body).append(h('h2', {}, d.title || 'Diktat'), card);
    const draw = () => {
      if (i >= sentences.length) {
        clear(card).append(h('div', { class: 'center-col' },
          h('h2', {}, mistakes === 0 ? 'Fehlerfrei! Wow.' : 'Diktat geschafft'),
          h('p', {}, mistakes === 0 ? 'Kein einziger Fehler.' : `${mistakes} Stellen sind jetzt in deiner Fehlerkartei und kommen bald wieder.`),
          h('button', { class: 'btn primary', onclick: start }, 'Noch ein Diktat')));
        if (mistakes === 0) avatar.set('happy');
        return;
      }
      const s = sentences[i];
      const input = h('textarea', { rows: 3, 'aria-label': 'Dein Satz', spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off' });
      const out = h('div', { class: 'result' });
      const checkBtn = h('button', { class: 'btn primary', onclick: async () => {
        const typed = input.value.trim();
        if (!typed) return toast('Schreib den Satz zuerst auf');
        checkBtn.disabled = true;
        if (typed === s.text.trim()) {
          clear(out).append(h('p', { class: 'score' }, 'Perfekt, alles richtig!'));
          avatar.set('happy');
        } else {
          clear(out).append(diffView(s.text, typed), loader('Brezel erklärt'));
          avatar.set('think');
          try {
            const r = await api.post('/api/de/check', { profileId: profile.id, expected: s.text, text: typed, mode: 'diktat' });
            out.lastChild.remove();
            mistakes += (r.errors || []).length || 1;
            out.append(h('p', {}, 'Richtig wäre: ', h('strong', {}, s.text)), errorList(r.errors), r.praise ? h('p', { class: 'muted' }, r.praise) : null);
          } catch (e) { out.lastChild.remove(); out.append(h('p', {}, 'Richtig wäre: ', h('strong', {}, s.text))); }
          avatar.set('idle');
        }
        out.append(h('button', { class: 'btn', onclick: () => { i++; draw(); } }, i < sentences.length - 1 ? 'Nächster Satz' : 'Fertig'));
      } }, 'Prüfen');
      clear(card).append(
        h('p', { class: 'muted' }, `Satz ${i + 1} von ${sentences.length}`),
        h('div', { class: 'row' },
          h('button', { class: 'btn', onclick: () => talk(avatar, s.text, 0.85) }, 'Vorlesen'),
          h('button', { class: 'btn ghost', onclick: () => talk(avatar, s.text, 0.65) }, 'Ganz langsam')),
        input, checkBtn, out);
      talk(avatar, s.text, 0.85);
      input.focus();
    };
    draw();
  }
}

async function schreiben(ctx) {
  const { body, profile, avatar } = ctx;
  const draft = store('draft_' + profile.id) || null;
  async function newTask() {
    avatar.set('think');
    clear(body).append(loader('Brezel denkt sich eine Aufgabe aus'));
    try {
      const t = await api.post('/api/de/aufgabe', { profileId: profile.id });
      store('draft_' + profile.id, { task: t, text: '' });
      show({ task: t, text: '' });
    } catch (e) { toast(e.message, 'error'); clear(body); }
    avatar.set('idle');
  }
  function show(d) {
    const t = d.task;
    const area = h('textarea', { class: 'essay', rows: 14, spellcheck: 'false', autocorrect: 'off', 'aria-label': 'Dein Text' }, d.text || '');
    const count = h('span', { class: 'muted' }, '');
    const upd = () => {
      const n = area.value.trim() ? area.value.trim().split(/\s+/).length : 0;
      count.textContent = `${n} von etwa ${t.words || 200} Wörtern`;
      store('draft_' + profile.id, { task: t, text: area.value });
    };
    area.addEventListener('input', upd);
    const out = h('div', { class: 'result' });
    const btn = h('button', { class: 'btn primary', onclick: async () => {
      if (area.value.trim().split(/\s+/).length < 30) return toast('Schreib noch ein bisschen mehr, mindestens 30 Wörter');
      btn.disabled = true; avatar.set('think');
      clear(out).append(loader('Brezel liest deinen Text'));
      try {
        const r = await api.post('/api/de/check', { profileId: profile.id, text: area.value, task: t.task, mode: 'aufsatz' });
        clear(out).append(
          r.praise ? h('div', { class: 'praise' }, r.praise) : null,
          (r.spelling || []).length ? h('h3', {}, 'Rechtschreibung und Zeichensetzung') : null, errorList(r.spelling),
          (r.grammar || []).length ? h('h3', {}, 'Grammatik') : null, errorList(r.grammar),
          (r.structure || []).length ? h('h3', {}, 'Aufbau') : null,
          (r.structure || []).length ? h('ul', {}, r.structure.map(s => h('li', {}, s))) : null,
          r.next_step ? h('p', { class: 'next-step' }, 'Fürs nächste Mal: ' + r.next_step) : null,
          h('p', { class: 'muted' }, 'Verbessere die Stellen selbst im Text und lass ihn gerne nochmal prüfen.'));
        avatar.set((r.spelling || []).length < 3 ? 'happy' : 'idle');
      } catch (e) { clear(out).append(h('p', { class: 'error' }, e.message)); avatar.set('idle'); }
      btn.disabled = false;
    } }, 'Text prüfen lassen');
    clear(body).append(h('div', { class: 'card' },
      h('h2', {}, t.title || 'Schreibaufgabe'), h('p', {}, t.task),
      (t.hints || []).length ? h('ul', { class: 'hints' }, t.hints.map(x => h('li', {}, x))) : null,
      area, h('div', { class: 'row' }, count, btn, h('button', { class: 'btn ghost', onclick: newTask }, 'Neue Aufgabe')), out));
    upd();
  }
  if (draft && draft.task) show(draft); else newTask();
}

async function kartei(ctx) {
  const { body, profile, avatar } = ctx;
  clear(body).append(loader('Öffne die Fehlerkartei'));
  let due = [], all = [];
  try {
    [due, all] = await Promise.all([
      api.get(`/api/review?profileId=${profile.id}&lang=de`),
      api.get(`/api/cards?profileId=${profile.id}&lang=de&kind=error`)
    ]);
  } catch (e) { clear(body).append(h('p', { class: 'error' }, e.message)); return; }
  const cats = {};
  all.forEach(c => { const k = (c.extra && c.extra.category) || 'Sonstiges'; cats[k] = (cats[k] || 0) + 1; });
  const stats = h('div', { class: 'card' }, h('h2', {}, 'Deine Baustellen'),
    Object.keys(cats).length
      ? h('ul', { class: 'cats' }, Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([k, n]) => h('li', {}, h('strong', {}, k), h('span', { class: 'muted' }, ` ${n}`))))
      : h('p', { class: 'muted' }, 'Noch leer. Mach ein Diktat oder lass einen Text prüfen.'));
  const card = h('div', { class: 'card' });
  clear(body).append(card, stats);
  const queue = due.slice();
  const next = () => {
    if (!queue.length) {
      clear(card).append(h('p', {}, due.length ? 'Alle fälligen Fehler geübt. Stark!' : 'Heute ist keine Karte fällig.'));
      if (due.length) avatar.set('happy');
      return;
    }
    const c = queue[0];
    const input = h('input', { type: 'text', 'aria-label': 'Richtige Schreibweise', spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off' });
    const out = h('div', { class: 'result' });
    const go = async (known) => {
      try { await api.post('/api/review/' + c.id, { known }); } catch (e) {}
      queue.shift(); next();
    };
    const check = h('button', { class: 'btn primary', onclick: () => {
      const ok = input.value.trim() === c.back.trim();
      clear(out).append(
        ok ? h('p', { class: 'score' }, 'Richtig!') : diffView(c.back, input.value.trim()),
        h('p', {}, 'Richtig: ', h('strong', {}, c.back)),
        c.extra && c.extra.rule ? h('p', { class: 'rule' }, c.extra.rule) : null,
        h('button', { class: 'btn', onclick: () => go(ok) }, 'Weiter'));
      avatar.set(ok ? 'happy' : 'idle');
    } }, 'Prüfen');
    input.addEventListener('keydown', e => { if (e.key === 'Enter') check.click(); });
    clear(card).append(
      h('p', { class: 'muted' }, `Noch ${queue.length} fällig. So stand es mal falsch da. Schreib es richtig:`),
      h('p', { class: 'front wrong' }, c.front), input, check, out);
    input.focus();
  };
  next();
}

async function gedicht(ctx) {
  const { body, profile, avatar } = ctx;
  const wrap = h('div', {});
  const card = dailyCard(profile, 'de', 'poem', null, avatar);
  const area = h('textarea', { rows: 8, spellcheck: 'false', autocorrect: 'off', 'aria-label': 'Gedicht abschreiben' });
  const out = h('div', { class: 'result' });
  const btn = h('button', { class: 'btn primary', onclick: () => {
    const lines = Array.from(card.querySelectorAll('.poem-line')).map(p => p.textContent);
    const expected = lines.join('\n');
    if (!expected) return;
    const typed = area.value.replace(/\r/g, '').trim();
    const d = charDiff(expected, typed);
    const errs = d.filter(x => x.t !== 'same').length;
    clear(out).append(h('p', { class: 'score' }, errs === 0 ? 'Fehlerfrei abgeschrieben!' : `${errs} Zeichen weichen ab:`),
      errs ? h('pre', { class: 'diff' }, d.map(x => x.t === 'same' ? x.c : h('span', { class: x.t }, x.c === '\n' ? '↵\n' : x.c))) : null);
    avatar.set(errs === 0 ? 'happy' : 'idle');
  } }, 'Vergleichen');
  wrap.append(card, h('div', { class: 'card' },
    h('h2', {}, 'Abschreiben'),
    h('p', { class: 'muted' }, 'Gute Texte abzuschreiben schult die Rechtschreibung ganz nebenbei. Achte auf jedes Komma.'),
    area, btn, out));
  clear(body).append(wrap);
}

export async function renderGerman(ctx) {
  const fn = { diktat, schreiben, kartei, gedicht }[ctx.mode] || diktat;
  await fn(ctx);
  return () => stopSpeaking();
}
