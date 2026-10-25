import { LANGS } from './util.js';

const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function setWorld(lang) {
  const root = document.documentElement;
  const m = LANGS[lang];
  if (!m) {
    root.removeAttribute('data-world');
    root.style.removeProperty('--w1');
    root.style.removeProperty('--w2');
    return;
  }
  root.dataset.world = lang;
  root.style.setProperty('--w1', m.color);
  root.style.setProperty('--w2', m.color2);
}

export function countUp(el, to, { duration = 900, suffix = '' } = {}) {
  const target = Number(to) || 0;
  if (reduce || target === 0) { el.textContent = target + suffix; return; }
  const start = performance.now();
  const tick = (now) => {
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * eased) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function spotlight(el) {
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    el.style.setProperty('--my', (e.clientY - r.top) + 'px');
  });
  return el;
}

/* Funken beim Klick auf Buttons */
export function initClickSpark() {
  if (reduce) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'spark-canvas';
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  let sparks = [];
  const resize = () => {
    canvas.width = innerWidth * devicePixelRatio;
    canvas.height = innerHeight * devicePixelRatio;
  };
  resize();
  addEventListener('resize', resize);
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('button, .pill, .tile')) return;
    const now = performance.now();
    const color = getComputedStyle(document.documentElement).getPropertyValue('--w1').trim() || '#fff';
    for (let i = 0; i < 9; i++) sparks.push({ x: e.clientX, y: e.clientY, a: (Math.PI * 2 * i) / 9, t: now, color });
    if (sparks.length === 9) requestAnimationFrame(draw);
  });
  function draw(now) {
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    sparks = sparks.filter(s => now - s.t < 420);
    for (const s of sparks) {
      const p = (now - s.t) / 420;
      const d = 6 + 26 * (1 - Math.pow(1 - p, 2));
      const len = 9 * (1 - p);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x + Math.cos(s.a) * d, s.y + Math.sin(s.a) * d);
      ctx.lineTo(s.x + Math.cos(s.a) * (d + len), s.y + Math.sin(s.a) * (d + len));
      ctx.stroke();
    }
    if (sparks.length) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, innerWidth, innerHeight);
  }
}

export function stagger(container) {
  const items = container.querySelectorAll('.reveal');
  items.forEach((el, i) => { el.style.animationDelay = (i * 70) + 'ms'; });
}
