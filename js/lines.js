import { h } from './util.js';

/* Birkenbihl-Zeile: Wort in der Zielsprache, darunter die wörtliche Bedeutung */
export function interlinear(line, lang, { decode = true, roman = true, translation = false, speaker = true } = {}) {
  const words = Array.isArray(line.words) ? line.words : [];
  const row = h('div', { class: 'il' + (decode ? '' : ' no-decode'), lang });
  if (words.length) {
    for (const w of words) {
      const isJa = lang === 'ja' && w.length >= 3;
      row.append(h('span', { class: 'il-w' },
        h('span', { class: 'il-t' }, w[0]),
        isJa && roman ? h('span', { class: 'il-r' }, w[1]) : null,
        h('span', { class: 'il-d', lang: 'de' }, isJa ? w[2] : w[1])));
    }
  } else {
    row.append(h('span', { class: 'il-w' }, h('span', { class: 'il-t' }, line.text)));
  }
  return h('div', { class: 'line' },
    speaker && line.speaker ? h('span', { class: 'speaker' }, line.speaker) : null,
    row,
    lang === 'ja' && roman && line.roman ? h('p', { class: 'roman' }, line.roman) : null,
    line.de ? h('p', { class: 'de' + (translation ? '' : ' hidden-de'), lang: 'de' }, line.de) : null);
}

export function plainLine(line, lang) {
  return h('div', { class: 'line plain' },
    line.speaker ? h('span', { class: 'speaker' }, line.speaker) : null,
    h('p', { class: 'target', lang }, line.text),
    lang === 'ja' && line.roman ? h('p', { class: 'roman' }, line.roman) : null);
}
