import { h, clear, toast, loader, LANGS } from './util.js';
import { api } from './api.js';
import { say, stopSpeaking, Recorder, transcribe } from './audio.js';

export async function renderChat(ctx) {
  const { body, profile, lang, avatar, app } = ctx;
  let alive = true;
  let busy = false;
  let errorsInRow = 0;
  const history = [];
  const rec = new Recorder();
  let duo = null;
  let nextSpeaker = '';
  let recBtn = null;

  const log = h('div', { class: 'chat-log', 'aria-live': 'polite' });
  const text = h('input', { type: 'text', placeholder: 'Oder hier tippen', 'aria-label': 'Nachricht tippen', autocomplete: 'off' });
  const micRow = h('div', { class: 'mic-row' });
  const form = h('form', { class: 'chat-input', onsubmit: (e) => { e.preventDefault(); const v = text.value.trim(); if (v) { text.value = ''; send(v, duo ? duo.speakerFor(nextSpeaker) : null); } } },
    text, h('button', { class: 'btn', type: 'submit' }, 'Senden'));

  let partners = [];
  try { partners = (await api.get('/api/profiles')).filter(p => p.id !== profile.id && (p.languages || []).includes(lang)); } catch (e) {}
  const duoSel = partners.length ? h('select', { 'aria-label': 'Duo-Partner', onchange: (e) => setDuo(e.target.value) },
    h('option', { value: '' }, 'Allein üben'),
    partners.map(p => h('option', { value: p.id }, 'Duo mit ' + p.name))) : null;

  clear(body).append(
    h('div', { class: 'chat-top' },
      h('p', { class: 'muted' }, 'Tippe aufs Mikrofon, sprich und tippe nochmal. Antworten kannst du antippen, um sie nochmal zu hören.'),
      duoSel),
    log, micRow, form);

  function drawMics() {
    clear(micRow);
    if (!duo) {
      recBtn = micButton(null, profile.name);
      micRow.append(recBtn);
    } else {
      micRow.append(micButton(duo.me.id, duo.me.name), micButton(duo.partner.id, duo.partner.name));
    }
    highlightNext();
  }

  function highlightNext() {
    micRow.querySelectorAll('.mic-wrap').forEach(w => w.classList.toggle('next', !!duo && w.dataset.name === nextSpeaker));
  }

  function micButton(speakerId, name) {
    const b = h('button', { class: 'mic', 'aria-label': name + ': Aufnahme starten' }, h('span', { class: 'mic-dot' }));
    b.addEventListener('click', async () => {
      if (busy && !rec.active) return;
      if (rec.active) {
        b.classList.remove('rec');
        const blob = await rec.stop();
        if (!blob) { avatar.set('idle'); return; }
        avatar.set('think');
        busy = true;
        const pending = bubble('user', '…', null, name);
        try {
          const said = await transcribe(blob, lang, history.length ? history[history.length - 1].content : '');
          if (!said) { pending.remove(); toast('Ich habe nichts verstanden. Nochmal?'); avatar.set('idle'); busy = false; return; }
          pending.querySelector('.msg-text').textContent = said;
          busy = false;
          await send(said, speakerId, true);
        } catch (e) { pending.remove(); toast(e.message, 'error'); avatar.set('idle'); busy = false; }
      } else {
        stopSpeaking();
        try { await rec.start(); b.classList.add('rec'); avatar.set('listen'); }
        catch (e) { toast('Mikrofon nicht verfügbar: ' + e.message, 'error'); }
      }
    });
    return h('div', { class: 'mic-wrap', 'data-name': name }, b, h('span', { class: 'mic-name' }, name));
  }

  function bubble(role, content, extra, who) {
    const el = h('div', { class: 'msg ' + role },
      who && duo ? h('span', { class: 'who' }, who) : null,
      h('p', { class: 'msg-text', lang: role === 'assistant' ? lang : 'de' }, content),
      extra || null);
    log.append(el);
    log.scrollTop = log.scrollHeight;
    el.scrollIntoView({ block: 'end', behavior: 'smooth' });
    return el;
  }

  async function send(userText, speakerId, alreadyShown) {
    if (busy) return;
    busy = true;
    const who = duo ? (speakerId === duo.partner.id ? duo.partner.name : duo.me.name) : profile.name;
    if (userText && !alreadyShown) bubble('user', userText, null, who);
    avatar.set('think');
    const thinking = h('div', { class: 'msg assistant thinking' }, loader(''));
    log.append(thinking);
    try {
      const res = await api.post('/api/chat', {
        profileId: profile.id, lang, history, text: userText || '',
        duo: duo ? { partnerId: duo.partner.id, speakerId: speakerId || duo.me.id } : undefined
      });
      thinking.remove();
      if (!alive) return;
      if (userText) history.push({ role: 'user', content: duo ? `[${who}] ${userText}` : userText });
      history.push({ role: 'assistant', content: res.reply || '' });
      const extra = h('div', { class: 'msg-extra' },
        res.roman ? h('p', { class: 'roman' }, res.roman) : null,
        res.reply_de ? h('p', { class: 'de hidden-de', lang: 'de' }, res.reply_de) : null,
        res.correction && res.correction.right ? h('div', { class: 'correction' },
          h('span', {}, 'Besser so: '), h('strong', { lang }, res.correction.right),
          res.correction.wrong ? h('span', { class: 'muted' }, ` statt „${res.correction.wrong}“`) : null,
          res.correction.rule ? h('p', { class: 'rule' }, res.correction.rule) : null) : null);
      const el = bubble('assistant', res.reply || '', extra);
      el.addEventListener('click', (e) => {
        if (e.target.closest('.correction')) return;
        const de = el.querySelector('.de'); if (de) de.classList.remove('hidden-de');
        speak(res.reply);
      });
      if (res.correction && res.correction.right) errorsInRow++; else errorsInRow = 0;
      if (res.placement_done && res.level) toast(`Eingestuft: Niveau ${res.level}`);
      nextSpeaker = res.next_speaker || '';
      highlightNext();
      busy = false;
      await speak(res.reply);
      if (res.praise) avatar.set('happy');
      ctx.onBreakCheck(ctx, { errorsInRow });
    } catch (e) {
      thinking.remove();
      toast(e.message, 'error');
      avatar.set('idle');
      busy = false;
    }
  }

  function speak(t) {
    return say(t, lang, { onStart: () => avatar.set('talk'), onEnd: () => { if (avatar.state === 'talk') avatar.set('idle'); } });
  }

  function setDuo(id) {
    const partner = partners.find(p => String(p.id) === String(id));
    duo = partner ? {
      me: { id: profile.id, name: profile.name }, partner: { id: partner.id, name: partner.name },
      speakerFor: (n) => n === partner.name ? partner.id : profile.id
    } : null;
    history.length = 0;
    clear(log);
    drawMics();
    send('', null);
  }

  drawMics();
  send('', null);
  return () => { alive = false; stopSpeaking(); if (rec.active) rec.stop(); };
}
